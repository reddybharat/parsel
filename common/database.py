"""
Shared PostgreSQL connection via DATABASE_URL.

Used by tracker (CRUD) and chat (read-only agent). Provides only connection
creation and lifecycle; execute/query helpers live in tracker and chat utilities.
"""

import os
from contextlib import contextmanager

import psycopg2
from psycopg2.pool import SimpleConnectionPool

_DATABASE_URL: str | None = None
_POOL: SimpleConnectionPool | None = None


def get_database_url() -> str:
    """Return DATABASE_URL from environment. Raises ValueError if not set."""
    global _DATABASE_URL
    if _DATABASE_URL is None:
        _DATABASE_URL = os.getenv("DATABASE_URL")
    if not _DATABASE_URL:
        raise ValueError(
            "DATABASE_URL must be set in .env to use database."
        )
    return _DATABASE_URL


def is_database_configured() -> bool:
    """Return True if DATABASE_URL is set."""
    return bool(os.getenv("DATABASE_URL"))


def _get_pool() -> SimpleConnectionPool:
    global _POOL
    if _POOL is None:
        _POOL = SimpleConnectionPool(
            minconn=1,
            maxconn=5,
            dsn=get_database_url(),
        )
    return _POOL


@contextmanager
def get_connection():
    """Context manager yielding a DB connection. Commits on success, rolls back on exception."""
    pool = _get_pool()
    conn = pool.getconn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        pool.putconn(conn)
