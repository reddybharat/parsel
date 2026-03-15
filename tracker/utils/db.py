"""
Tracker DB execute helpers.

Require a connection (from common.database). Used by tracker API, UI, and services.
"""

from typing import Any, Optional

import psycopg2
from psycopg2.extras import RealDictCursor

CONNECTION_REQUIRED_MSG = "Database connection unavailable."


def execute_query(
    sql: str,
    params: Optional[tuple | dict] = None,
    conn: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Run a SELECT; return rows as list of dicts (column name -> value). conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def execute_insert(
    sql: str,
    params: Optional[tuple | dict] = None,
    conn: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Run INSERT ... RETURNING *; return inserted row(s) as list of dicts. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]


def execute_update_delete(
    sql: str,
    params: Optional[tuple | dict] = None,
    conn: Optional[Any] = None,
) -> int:
    """Run UPDATE or DELETE; return number of rows affected. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return cur.rowcount


def execute_update_returning(
    sql: str,
    params: Optional[tuple | dict] = None,
    conn: Optional[Any] = None,
) -> list[dict[str, Any]]:
    """Run UPDATE ... RETURNING *; return updated row(s) as list of dicts. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(sql, params)
        return [dict(row) for row in cur.fetchall()]
