"""
Shared PostgreSQL connection via DATABASE_URL.

Used by tracker (CRUD) and chat (read-only agent). Provides only connection
creation and lifecycle; execute/query helpers live in tracker and chat utilities.
"""

import os
from contextlib import contextmanager

import psycopg2
from dotenv import load_dotenv

load_dotenv()

_DATABASE_URL: str | None = None


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


def open_session_connection():
    """Open a connection for the session. Caller must commit after writes and must not close (reused)."""
    return psycopg2.connect(get_database_url())


@contextmanager
def get_connection():
    """Context manager yielding a DB connection. Commits on success, rolls back on exception."""
    conn = psycopg2.connect(get_database_url())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
