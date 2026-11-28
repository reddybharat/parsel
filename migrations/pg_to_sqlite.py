"""One-time copy of an existing Parsel PostgreSQL database into the SQLite file.

Usage (from the repo root, with the backend venv active):
    pip install asyncpg
    python migrations/pg_to_sqlite.py --from postgresql://parsel:<password>@localhost:5432/parsel

PostgreSQL is only read, never written. The SQLite DB must be empty (no rows).
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path
from typing import Any

_BACKEND_DIR = Path(__file__).resolve().parents[1] / "backend"
sys.path.insert(0, str(_BACKEND_DIR))

from dotenv import load_dotenv  # noqa: E402

load_dotenv(_BACKEND_DIR / ".env")

from common.database import init_database  # noqa: E402  (also registers uuid/date adapters)

# Parents before children so foreign keys hold.
TABLES = ("users", "user_banks", "transactions", "monthly_insights")
OPTIONAL_TABLES = frozenset({"monthly_insights"})
_JSON_COLUMNS = frozenset({"preferences", "facts", "questions"})
_SQLITE_TIMESTAMP_FORMAT = "%Y-%m-%d %H:%M:%S.%f"


def _to_sqlite(column: str, value: Any) -> Any:
    if value is None:
        return None
    # asyncpg returns its own UUID subclass; sqlite3 adapters only match exact types.
    if isinstance(value, uuid.UUID):
        return str(value)
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value.strftime(_SQLITE_TIMESTAMP_FORMAT)
    if column in _JSON_COLUMNS and not isinstance(value, str):
        return json.dumps(value)
    return value


def _sqlite_columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in conn.execute(f"PRAGMA table_info({table})")]


async def _read_postgres(url: str, columns: dict[str, list[str]]) -> dict[str, list[tuple]]:
    try:
        import asyncpg
    except ImportError:
        sys.exit("asyncpg is needed for this one-time copy. Run: pip install asyncpg")

    pg = await asyncpg.connect(url)
    try:
        rows: dict[str, list[tuple]] = {}
        async with pg.transaction(isolation="repeatable_read", readonly=True):
            for table in TABLES:
                exists = await pg.fetchval("SELECT to_regclass($1) IS NOT NULL", f"public.{table}")
                if not exists:
                    if table in OPTIONAL_TABLES:
                        print(f"  {table}: not in PostgreSQL, skipped")
                        continue
                    sys.exit(f"PostgreSQL has no {table} table; is this a Parsel database?")
                cols = columns[table]
                records = await pg.fetch(f"SELECT {', '.join(cols)} FROM public.{table}")
                rows[table] = [
                    tuple(_to_sqlite(col, record[col]) for col in cols) for record in records
                ]
        return rows
    finally:
        await pg.close()


def copy(pg_url: str) -> dict[str, int]:
    """Copy all Parsel tables; returns row counts per table. Raises on any mismatch."""
    db_path = init_database()
    conn = sqlite3.connect(db_path, isolation_level=None)
    try:
        conn.execute("PRAGMA foreign_keys=ON")
        for table in TABLES:
            if conn.execute(f"SELECT EXISTS (SELECT 1 FROM {table})").fetchone()[0]:
                sys.exit(
                    f"{db_path} already has data in {table}; refusing to overwrite. "
                    "Point DATABASE_PATH at a new file or move this one aside."
                )
        columns = {table: _sqlite_columns(conn, table) for table in TABLES}
        rows = asyncio.run(_read_postgres(pg_url, columns))

        counts: dict[str, int] = {}
        conn.execute("BEGIN")
        try:
            for table, table_rows in rows.items():
                cols = columns[table]
                conn.executemany(
                    f"INSERT INTO {table} ({', '.join(cols)}) VALUES ({', '.join('?' for _ in cols)})",
                    table_rows,
                )
                copied = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
                if copied != len(table_rows):
                    raise RuntimeError(
                        f"{table}: PostgreSQL has {len(table_rows)} rows but SQLite got {copied}"
                    )
                counts[table] = copied
            conn.execute("COMMIT")
        except BaseException:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()
    return counts


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from", dest="pg_url", required=True, help="PostgreSQL URL of the old Parsel DB")
    args = parser.parse_args()
    pg_url = args.pg_url.replace("postgresql+asyncpg://", "postgresql://", 1)

    print("Copying PostgreSQL -> SQLite ...")
    counts = copy(pg_url)
    for table, count in counts.items():
        print(f"  {table}: {count} rows (matches PostgreSQL)")
    print("Done. Start Parsel and check your Overview totals.")


if __name__ == "__main__":
    main()
