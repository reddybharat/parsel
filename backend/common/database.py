"""
Shared SQLite engine/session utilities, schema migrations, and the chat agent's
read-only query runner.
"""

import asyncio
import os
import secrets
import sqlite3
import time
import uuid
from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import date
from pathlib import Path
from typing import Any

from sqlalchemy import URL, event
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import ConnectionPoolEntry, NullPool

from common.logger import get_logger

logger = get_logger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[2]
MIGRATIONS_DIR = REPO_ROOT / "migrations"
_DEFAULT_DATABASE_PATH = REPO_ROOT / "data" / "parsel.db"
_MIN_SQLITE_VERSION = (3, 35)  # RETURNING
_BUSY_TIMEOUT_MS = 5000
_BACKUPS_KEPT = 3
_BACKUP_MARKER = ".bak-v"
_AGENT_QUERY_TIMEOUT_SECONDS = 10
_AGENT_PROGRESS_INTERVAL = 1000  # SQLite VM steps between timeout checks
_AGENT_TABLE = "transactions"
AGENT_MAX_ROWS = 200
_AGENT_SCOPE_VIEW_PREFIX = "user_scope_"
_AGENT_SCOPE_VIEW_TOKEN_BYTES = 8
_AGENT_ALLOWED_ACTIONS = frozenset(
    {sqlite3.SQLITE_SELECT, sqlite3.SQLITE_FUNCTION, sqlite3.SQLITE_RECURSIVE}
)

# Raw text() params pass straight to sqlite3; keep UUIDs and dates as the stored text.
sqlite3.register_adapter(uuid.UUID, str)
sqlite3.register_adapter(date, date.isoformat)

_ASYNC_ENGINE: AsyncEngine | None = None
_SESSIONMAKER: async_sessionmaker[AsyncSession] | None = None
_READONLY_ENGINE: AsyncEngine | None = None
_READONLY_SESSIONMAKER: async_sessionmaker[AsyncSession] | None = None


def get_database_path() -> Path:
    """SQLite file from DATABASE_PATH, default `<repo>/data/parsel.db`."""
    return Path(os.getenv("DATABASE_PATH") or _DEFAULT_DATABASE_PATH)


def _check_environment() -> None:
    if os.getenv("DATABASE_URL", "").strip().lower().startswith("postgres"):
        raise RuntimeError(
            "backend/.env still sets DATABASE_URL to PostgreSQL, but Parsel now stores data in "
            "SQLite. Remove DATABASE_URL and CHAT_DATABASE_URL from backend/.env, then copy your "
            "data with: python migrations/pg_to_sqlite.py --from <your old DATABASE_URL>"
        )
    if sqlite3.sqlite_version_info < _MIN_SQLITE_VERSION:
        raise RuntimeError(
            f"SQLite {sqlite3.sqlite_version} is too old; Parsel needs "
            f"{'.'.join(map(str, _MIN_SQLITE_VERSION))}+. Install a newer Python from python.org."
        )


def _migration_number(path: Path) -> int:
    return int(path.name.split("_", 1)[0])


def _backup_version(path: Path) -> int | None:
    suffix = path.name.rsplit(_BACKUP_MARKER, 1)[-1]
    return int(suffix) if suffix.isdigit() else None


def _backup_before_migrating(conn: sqlite3.Connection, db_path: Path, version: int) -> None:
    """Copy the DB to `<name>.bak-v<version>` (WAL-safe), keeping only the newest backups."""
    backup_path = db_path.with_name(f"{db_path.name}{_BACKUP_MARKER}{version}")
    target = sqlite3.connect(backup_path)
    try:
        conn.backup(target)
    finally:
        target.close()
    logger.info("Backed up database to %s before migrating", backup_path)

    backups = [
        (found_version, path)
        for path in db_path.parent.glob(f"{db_path.name}{_BACKUP_MARKER}*")
        if (found_version := _backup_version(path)) is not None
    ]
    backups.sort(reverse=True)
    for _, old in backups[_BACKUPS_KEPT:]:
        old.unlink()
        logger.info("Removed old backup %s", old)


def init_database(migrations_dir: Path = MIGRATIONS_DIR) -> Path:
    """Create the DB if needed and apply pending `NNN_*.sql` migrations, one transaction each.

    `PRAGMA user_version` records the last applied migration. An existing DB is
    backed up before any pending migration runs.
    """
    _check_environment()
    db_path = get_database_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    migrations = sorted(migrations_dir.glob("[0-9][0-9][0-9]_*.sql"), key=_migration_number)

    conn = sqlite3.connect(db_path, isolation_level=None)
    try:
        conn.execute("PRAGMA journal_mode=WAL")
        version = conn.execute("PRAGMA user_version").fetchone()[0]
        pending = [path for path in migrations if _migration_number(path) > version]
        if pending and version > 0:
            _backup_before_migrating(conn, db_path, version)
        for path in pending:
            number = _migration_number(path)
            sql = path.read_text(encoding="utf-8")
            try:
                conn.executescript(f"BEGIN;\n{sql}\n;\nPRAGMA user_version = {number};\nCOMMIT;")
            except sqlite3.Error:
                if conn.in_transaction:
                    conn.execute("ROLLBACK")
                logger.exception("Migration %s failed; database left at version %d", path.name, version)
                raise
            version = number
            logger.info("Applied migration %s", path.name)
    finally:
        conn.close()
    return db_path


def _database_url() -> URL:
    return URL.create("sqlite+aiosqlite", database=str(get_database_path()))


def _set_pragmas(dbapi_connection: Any, _record: ConnectionPoolEntry) -> None:
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute(f"PRAGMA busy_timeout={_BUSY_TIMEOUT_MS}")
    cursor.close()


def _disable_driver_transactions(dbapi_connection: Any, _record: ConnectionPoolEntry) -> None:
    dbapi_connection.isolation_level = None


def _begin_immediate(conn: Connection) -> None:
    # Take the write lock up front: serializes writers (SQLite ignores FOR UPDATE).
    conn.exec_driver_sql("BEGIN IMMEDIATE")


# NullPool: SQLite connections are cheap to open, and pooled aiosqlite
# connections must not be shared across event loops (tests run one per test).
def get_async_engine() -> AsyncEngine:
    global _ASYNC_ENGINE
    if _ASYNC_ENGINE is None:
        engine = create_async_engine(_database_url(), poolclass=NullPool)
        event.listen(engine.sync_engine, "connect", _set_pragmas)
        event.listen(engine.sync_engine, "connect", _disable_driver_transactions)
        event.listen(engine.sync_engine, "begin", _begin_immediate)
        _ASYNC_ENGINE = engine
    return _ASYNC_ENGINE


def get_readonly_engine() -> AsyncEngine:
    """Read-only engine; AUTOCOMMIT skips BEGIN/COMMIT around SELECTs."""
    global _READONLY_ENGINE
    if _READONLY_ENGINE is None:
        engine = create_async_engine(
            _database_url(), poolclass=NullPool, isolation_level="AUTOCOMMIT"
        )
        event.listen(engine.sync_engine, "connect", _set_pragmas)
        _READONLY_ENGINE = engine
    return _READONLY_ENGINE


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _SESSIONMAKER
    if _SESSIONMAKER is None:
        _SESSIONMAKER = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _SESSIONMAKER


def get_readonly_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _READONLY_SESSIONMAKER
    if _READONLY_SESSIONMAKER is None:
        _READONLY_SESSIONMAKER = async_sessionmaker(
            bind=get_readonly_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _READONLY_SESSIONMAKER


@asynccontextmanager
async def get_connection() -> AsyncIterator[AsyncSession]:
    """Read-write session (commits on success)."""
    session = get_sessionmaker()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


@asynccontextmanager
async def get_readonly_connection() -> AsyncIterator[AsyncSession]:
    """Read-only session — SELECTs only; writes must use `get_connection`."""
    session = get_readonly_sessionmaker()()
    try:
        yield session
    finally:
        await session.close()


def _agent_authorizer(scope_view: str) -> Callable[[int, str | None, str | None, str | None, str | None], int]:
    """Allow SELECTs that reach `main.transactions` only through this connection's scope view.

    SQLite tags each read with the innermost view (or CTE) it came through. The
    scope view's name is random per connection, so a query can't fake that tag,
    e.g. with a CTE named `transactions` over `main.transactions`.
    """

    def authorize(action: int, table: str | None, _column: str | None, db: str | None, via: str | None) -> int:
        if action in _AGENT_ALLOWED_ACTIONS:
            return sqlite3.SQLITE_OK
        if action != sqlite3.SQLITE_READ:
            return sqlite3.SQLITE_DENY
        if db is None:  # CTE / subquery columns
            return sqlite3.SQLITE_OK
        if db == "temp" and table in (_AGENT_TABLE, scope_view):
            return sqlite3.SQLITE_OK
        if db == "main" and table == _AGENT_TABLE and via == scope_view:
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY

    return authorize


def _run_agent_query_sync(sql: str, user_id: uuid.UUID) -> tuple[list[dict[str, Any]], bool]:
    uri = f"{get_database_path().resolve().as_uri()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    try:
        # Temp views shadow the real table, so the agent's `transactions` is only this
        # user's rows. str(UUID) is hex and dashes only, so the literal is safe.
        scope_view = f"{_AGENT_SCOPE_VIEW_PREFIX}{secrets.token_hex(_AGENT_SCOPE_VIEW_TOKEN_BYTES)}"
        conn.execute(
            f"CREATE TEMP VIEW {scope_view} AS "
            f"SELECT * FROM main.{_AGENT_TABLE} WHERE user_id = '{user_id}'"
        )
        conn.execute(f"CREATE TEMP VIEW {_AGENT_TABLE} AS SELECT * FROM {scope_view}")

        deadline = time.monotonic() + _AGENT_QUERY_TIMEOUT_SECONDS
        conn.set_progress_handler(
            lambda: 1 if time.monotonic() > deadline else 0, _AGENT_PROGRESS_INTERVAL
        )
        conn.set_authorizer(_agent_authorizer(scope_view))
        cursor = conn.execute(sql)  # execute() rejects multiple statements
        columns = [col[0] for col in cursor.description or ()]
        rows = cursor.fetchmany(AGENT_MAX_ROWS + 1)
        return [dict(zip(columns, row)) for row in rows[:AGENT_MAX_ROWS]], len(rows) > AGENT_MAX_ROWS
    finally:
        conn.close()


async def run_agent_query(sql: str, *, user_id: uuid.UUID) -> tuple[list[dict[str, Any]], bool]:
    """Run chat-agent SQL read-only, seeing only `user_id`'s rows of `transactions`.

    Returns (at most AGENT_MAX_ROWS rows, whether more rows were cut off).
    Raises sqlite3.Error on denied, invalid, or timed-out queries.
    """
    return await asyncio.to_thread(_run_agent_query_sync, sql, uuid.UUID(str(user_id)))
