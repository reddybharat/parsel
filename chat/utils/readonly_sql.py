"""
SQL executor with guardrails for the chat agent.

Uses the shared connection (common.database). When run from Streamlit, uses the
session connection from app start via set_agent_connection().

Note: Originally this module enforced read-only SELECT queries only. The current
configuration allows the LLM to execute any single statement; guardrails now
focus on blocking multiple statements and SQL comments. The system prompt for
the agent is expected to keep queries read-only in practice.
"""

import re
from contextvars import ContextVar
from typing import Any, Optional, Union

# Type for query parameters (tuple or list, as accepted by psycopg2).
QueryParams = Optional[Union[tuple, list]]

import psycopg2
import psycopg2.extras

from common.database import get_connection, is_database_configured
from common.logger import get_logger

logger = get_logger(__name__)

# When set by the Streamlit chat tab, agent tools use this connection instead of opening a new one.
_agent_conn: ContextVar[Optional[Any]] = ContextVar("agent_conn", default=None)

MAX_ROWS_DEFAULT = 500

_BLOCKED_PATTERNS = re.compile(r"(--|/\*|;\s*\S)")


def set_agent_connection(conn: Optional[Any]) -> None:
    """Set the connection for the agent to use (e.g. session db_conn from Streamlit). Pass None to clear."""
    _agent_conn.set(conn)


class SQLSecurityError(Exception):
    """Raised when a query violates security constraints."""


def _validate_query(sql: str) -> str:
    """Validate and sanitize a SQL query. Returns cleaned SQL or raises.

    Guardrails:
    - Disallow multiple statements separated by semicolons.
    - Disallow SQL comments (-- or /* ... */).

    Query type (SELECT/INSERT/UPDATE/DELETE/etc.) is no longer restricted here.
    """
    cleaned = sql.strip().rstrip(";").strip()

    if not cleaned:
        raise SQLSecurityError("Empty query.")

    if _BLOCKED_PATTERNS.search(cleaned):
        semicolons = cleaned.count(";")
        if semicolons > 0:
            raise SQLSecurityError("Multiple statements are not allowed.")
        if "--" in cleaned or "/*" in cleaned:
            raise SQLSecurityError("SQL comments are not allowed.")

    return cleaned


def _enforce_row_limit(sql: str, max_rows: int) -> str:
    """Inject or cap LIMIT clause to enforce max_rows for SELECT queries.

    Non-SELECT statements are returned unchanged.
    """
    if not re.match(r"^\s*SELECT\b", sql, re.IGNORECASE):
        return sql

    limit_match = re.search(r"\bLIMIT\s+(\d+)", sql, re.IGNORECASE)
    if limit_match:
        existing_limit = int(limit_match.group(1))
        if existing_limit > max_rows:
            sql = sql[: limit_match.start(1)] + str(max_rows) + sql[limit_match.end(1) :]
    else:
        sql = sql + f" LIMIT {max_rows}"
    return sql


def _run_query(conn: Any, limited: str, params: QueryParams) -> list[dict]:
    """Execute validated SQL on conn and return rows as list of dicts. Caller owns conn lifecycle."""
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            if params is not None:
                cur.execute(limited, params)
            else:
                cur.execute(limited)
            rows = cur.fetchall()
            return [dict(row) for row in rows]
    except SQLSecurityError:
        raise
    except psycopg2.Error as e:
        logger.error("Database query failed: %s | Query: %s", e, limited)
        raise SQLSecurityError("Query execution failed. Please check your query and try again.")
    except Exception as e:
        logger.error("Unexpected error during query: %s", e)
        raise SQLSecurityError("An unexpected error occurred.")


def execute_readonly_query(
    sql: str,
    max_rows: int = MAX_ROWS_DEFAULT,
    conn: Optional[Any] = None,
    params: QueryParams = None,
) -> list[dict]:
    """Execute a SQL query and return rows as list of dicts.

    If conn is provided, use it and do not close it (caller's connection, e.g. session).
    If conn is None, use the connection from set_agent_connection() when set (Streamlit);
    otherwise create a new connection and close it when done (e.g. API).

    params: optional tuple or list of values for parameterized query (%s placeholders).
    Use this for user- or tool-supplied values (e.g. table names) instead of interpolating.

    Raises SQLSecurityError for disallowed queries.
    """
    cleaned = _validate_query(sql)
    limited = _enforce_row_limit(cleaned, max_rows)

    if conn is None:
        conn = _agent_conn.get()
    use_session_conn = conn is not None

    if not use_session_conn and not is_database_configured():
        raise SQLSecurityError(
            "DATABASE_URL is not configured. Set it in .env to enable SQL queries."
        )
    if use_session_conn:
        return _run_query(conn, limited, params)
    with get_connection() as conn:
        # Use pooled connection as-is (no read-only transaction); the agent
        # prompt is responsible for keeping queries read-only in practice.
        return _run_query(conn, limited, params)
