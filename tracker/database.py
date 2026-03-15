"""
Direct PostgreSQL connection via DATABASE_URL.
Provides get_connection() and helpers for parameterized SQL (SELECT, INSERT, UPDATE, DELETE).
"""

import os
from contextlib import contextmanager
from typing import Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv()

_DATABASE_URL: Optional[str] = None

CONNECTION_REQUIRED_MSG = "Database connection unavailable."


def _get_database_url() -> str:
    global _DATABASE_URL
    if _DATABASE_URL is None:
        _DATABASE_URL = os.getenv("DATABASE_URL")
    if not _DATABASE_URL:
        raise ValueError(
            "DATABASE_URL must be set in .env to use database."
        )
    return _DATABASE_URL


def open_session_connection():
    """Open a connection for the session. Caller must commit after writes and must not close (reused)."""
    return psycopg2.connect(_get_database_url())


@contextmanager
def get_connection():
    """Context manager yielding a DB connection. Commits on success, rolls back on exception."""
    conn = psycopg2.connect(_get_database_url())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute_query(sql: str, params: Optional[tuple | dict] = None, conn: Optional[Any] = None) -> list[dict[str, Any]]:
    """Run a SELECT; return rows as list of dicts (column name -> value). conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def execute_insert(sql: str, params: Optional[tuple | dict] = None, conn: Optional[Any] = None) -> list[dict[str, Any]]:
    """Run INSERT ... RETURNING *; return inserted row(s) as list of dicts. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def execute_update_delete(sql: str, params: Optional[tuple | dict] = None, conn: Optional[Any] = None) -> int:
    """Run UPDATE or DELETE; return number of rows affected. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount


def execute_update_returning(sql: str, params: Optional[tuple | dict] = None, conn: Optional[Any] = None) -> list[dict[str, Any]]:
    """Run UPDATE ... RETURNING *; return updated row(s) as list of dicts. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]
