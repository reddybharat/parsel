"""
Secure read-only SQL executor with guardrails.

Uses a direct Postgres connection (psycopg2) via DATABASE_URL.
Only single SELECT statements are allowed; all DML/DDL is blocked.
"""

import os
import re
from typing import Optional

import psycopg2
import psycopg2.extras
from dotenv import load_dotenv

from common.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

_DATABASE_URL: Optional[str] = os.getenv("DATABASE_URL")

MAX_ROWS_DEFAULT = 500

_BLOCKED_KEYWORDS = re.compile(
    r"\b("
    r"INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|"
    r"GRANT|REVOKE|COPY|EXECUTE|CALL|DO|PERFORM|"
    r"SET\s+ROLE|SET\s+SESSION|LOCK|VACUUM|REINDEX|CLUSTER|"
    r"NOTIFY|LISTEN|UNLISTEN|LOAD|IMPORT"
    r")\b",
    re.IGNORECASE,
)

_BLOCKED_PATTERNS = re.compile(
    r"(--|/\*|;\s*\S)",
)


class SQLSecurityError(Exception):
    """Raised when a query violates security constraints."""


def _get_connection():
    """Create a new Postgres connection from DATABASE_URL."""
    if not _DATABASE_URL:
        raise SQLSecurityError(
            "DATABASE_URL is not configured. "
            "Set it in .env to enable SQL queries."
        )
    return psycopg2.connect(_DATABASE_URL)


def _validate_query(sql: str) -> str:
    """Validate and sanitize a SQL query. Returns cleaned SQL or raises."""
    cleaned = sql.strip().rstrip(";").strip()

    if not cleaned:
        raise SQLSecurityError("Empty query.")

    if _BLOCKED_PATTERNS.search(cleaned):
        semicolons = cleaned.count(";")
        if semicolons > 0:
            raise SQLSecurityError("Multiple statements are not allowed.")
        if "--" in cleaned or "/*" in cleaned:
            raise SQLSecurityError("SQL comments are not allowed.")

    if not re.match(r"^\s*SELECT\b", cleaned, re.IGNORECASE):
        raise SQLSecurityError("Only SELECT queries are allowed.")

    if _BLOCKED_KEYWORDS.search(cleaned):
        match = _BLOCKED_KEYWORDS.search(cleaned)
        raise SQLSecurityError(
            f"Blocked keyword detected: {match.group(0).upper()}. "
            "Only read-only SELECT queries are permitted."
        )

    return cleaned


def _enforce_row_limit(sql: str, max_rows: int) -> str:
    """Inject or cap LIMIT clause to enforce max_rows."""
    limit_match = re.search(r"\bLIMIT\s+(\d+)", sql, re.IGNORECASE)
    if limit_match:
        existing_limit = int(limit_match.group(1))
        if existing_limit > max_rows:
            sql = sql[: limit_match.start(1)] + str(max_rows) + sql[limit_match.end(1) :]
    else:
        sql = sql + f" LIMIT {max_rows}"
    return sql


def execute_readonly_query(
    sql: str, max_rows: int = MAX_ROWS_DEFAULT
) -> list[dict]:
    """Execute a read-only SELECT query and return rows as list of dicts.

    Raises SQLSecurityError for disallowed queries.
    """
    cleaned = _validate_query(sql)
    limited = _enforce_row_limit(cleaned, max_rows)

    conn = None
    try:
        conn = _get_connection()
        conn.set_session(readonly=True, autocommit=True)
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
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
    finally:
        if conn:
            conn.close()


def is_configured() -> bool:
    """Check whether DATABASE_URL is set."""
    return bool(_DATABASE_URL)
