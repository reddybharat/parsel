"""SQLite layer: migrations, pre-migration backups, timestamps, upserts, LIKE escaping."""

import shutil
import sqlite3
import uuid
from datetime import date, timezone
from pathlib import Path

import pytest
from sqlalchemy import delete, select, text

from auth.models import User
from auth.service import register_user
from common.database import MIGRATIONS_DIR, get_connection, get_readonly_connection, init_database
from tracker.insight_service import _load_cached, _store
from tracker.models import Transaction, UserBank
from tracker.services import _get_bank_freshness, transaction_text_search


def _version(db_path: Path) -> int:
    conn = sqlite3.connect(db_path)
    try:
        return conn.execute("PRAGMA user_version").fetchone()[0]
    finally:
        conn.close()


def _latest_migration() -> int:
    return max(int(p.name[:3]) for p in MIGRATIONS_DIR.glob("[0-9][0-9][0-9]_*.sql"))


def _backups(db_path: Path) -> list[str]:
    return sorted(p.name for p in db_path.parent.glob(f"{db_path.name}.bak-v*"))


def test_fresh_db_reaches_latest_version_and_rerun_is_noop(tmp_path, monkeypatch):
    db_path = tmp_path / "data" / "parsel.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))

    assert init_database() == db_path
    assert _version(db_path) == _latest_migration()

    init_database()
    assert _version(db_path) == _latest_migration()
    assert _backups(db_path) == []


def test_pending_migration_backs_up_old_data_and_keeps_newest_three(tmp_path, monkeypatch):
    db_path = tmp_path / "parsel.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    migrations = tmp_path / "migrations"
    migrations.mkdir()
    shutil.copy(MIGRATIONS_DIR / "001_initial.sql", migrations)

    init_database(migrations)
    conn = sqlite3.connect(db_path)
    conn.execute(
        "INSERT INTO users (id, username, email, password_hash) VALUES (?, 'old', 'old@x', 'h')",
        (str(uuid.uuid4()),),
    )
    conn.commit()
    conn.close()

    (migrations / "002_extra.sql").write_text("CREATE TABLE extra_2 (i INTEGER);", encoding="utf-8")
    init_database(migrations)
    assert _version(db_path) == 2
    assert _backups(db_path) == ["parsel.db.bak-v1"]
    backup = sqlite3.connect(db_path.with_name("parsel.db.bak-v1"))
    try:
        assert backup.execute("SELECT username FROM users").fetchall() == [("old",)]
        assert backup.execute("PRAGMA user_version").fetchone()[0] == 1
    finally:
        backup.close()

    init_database(migrations)
    assert _backups(db_path) == ["parsel.db.bak-v1"]

    for number in (3, 4, 5):
        (migrations / f"00{number}_extra.sql").write_text(
            f"CREATE TABLE extra_{number} (i INTEGER);", encoding="utf-8"
        )
        init_database(migrations)
    assert _version(db_path) == 5
    assert _backups(db_path) == ["parsel.db.bak-v2", "parsel.db.bak-v3", "parsel.db.bak-v4"]


def test_failed_migration_rolls_back_and_keeps_version(tmp_path, monkeypatch):
    db_path = tmp_path / "parsel.db"
    monkeypatch.setenv("DATABASE_PATH", str(db_path))
    migrations = tmp_path / "migrations"
    migrations.mkdir()
    shutil.copy(MIGRATIONS_DIR / "001_initial.sql", migrations)
    init_database(migrations)

    (migrations / "002_broken.sql").write_text(
        "CREATE TABLE half_done (i INTEGER);\nNOT VALID SQL;", encoding="utf-8"
    )
    with pytest.raises(sqlite3.Error):
        init_database(migrations)
    assert _version(db_path) == 1
    conn = sqlite3.connect(db_path)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
    finally:
        conn.close()
    assert "half_done" not in tables


def test_legacy_postgres_url_is_refused(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://parsel:pw@localhost:5432/parsel")
    with pytest.raises(RuntimeError, match="pg_to_sqlite.py"):
        init_database()


async def _new_user() -> uuid.UUID:
    user_id = uuid.uuid4()
    async with get_connection() as session:
        session.add(
            User(id=user_id, username=f"u-{user_id}", email=f"{user_id}@example.com", password_hash="x")
        )
    return user_id


async def _drop_user(user_id: uuid.UUID) -> None:
    async with get_connection() as session:
        await session.execute(delete(Transaction).where(Transaction.user_id == user_id))
        await session.execute(delete(UserBank).where(UserBank.user_id == user_id))
        await session.execute(delete(User).where(User.id == user_id))


@pytest.mark.anyio
async def test_timestamps_come_back_tz_aware_utc():
    user = await register_user(f"tz-{uuid.uuid4().hex[:8]}", f"{uuid.uuid4().hex}@example.com", "password123!")
    try:
        assert user.created_at.tzinfo is timezone.utc
        assert user.password_changed_at.tzinfo is timezone.utc
        async with get_connection() as session:
            session.add(UserBank(user_id=user.id, bank="SBI", opening_balance=0, opening_month=date(2026, 1, 1)))
            session.add(
                Transaction(user_id=user.id, amount=10, is_debit=True, category="Food", bank="SBI",
                            transaction_date=date(2026, 1, 2))
            )
        (fresh,) = await _get_bank_freshness(user_id=user.id)
        assert fresh["last_added_at"].tzinfo is timezone.utc
        assert str(fresh["last_transaction_date"]) == "2026-01-02"
    finally:
        await _drop_user(user.id)


@pytest.mark.anyio
async def test_insight_upsert_round_trip():
    user_id = await _new_user()
    month = date(2026, 7, 1)
    try:
        first = await _store(user_id, month, "1:a", "First.", {"category": "Food"}, ["q1"])
        assert first.tzinfo is timezone.utc
        await _store(user_id, month, "2:b", "Second.", {"category": "Dining"}, ["q2"])

        cached = await _load_cached(user_id, month)
        assert cached is not None
        assert cached["fingerprint"] == "2:b"
        assert cached["sentence"] == "Second."
        assert cached["generated_at"].tzinfo is timezone.utc
        async with get_readonly_connection() as session:
            count = (
                await session.execute(
                    text("SELECT COUNT(*) FROM monthly_insights WHERE user_id = :u"), {"u": user_id}
                )
            ).scalar_one()
        assert count == 1
    finally:
        async with get_connection() as session:
            await session.execute(text("DELETE FROM monthly_insights WHERE user_id = :u"), {"u": user_id})
        await _drop_user(user_id)


@pytest.mark.anyio
async def test_search_treats_percent_and_underscore_literally():
    user_id = await _new_user()
    try:
        async with get_connection() as session:
            for description in ("50% off", "500 off", "a_b", "axb"):
                session.add(
                    Transaction(user_id=user_id, amount=1, is_debit=True, category="Shopping",
                                bank="SBI", transaction_date=date(2026, 1, 1), description=description)
                )

        async def search(term: str) -> list[str]:
            async with get_readonly_connection() as session:
                rows = await session.execute(
                    select(Transaction.description)
                    .where(Transaction.user_id == user_id, transaction_text_search(term))
                    .order_by(Transaction.description)
                )
            return [row[0] for row in rows]

        assert await search("50%") == ["50% off"]
        assert await search("A_B") == ["a_b"]
        assert await search("OFF") == ["50% off", "500 off"]
    finally:
        await _drop_user(user_id)

