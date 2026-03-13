"""
Custom tools for the SQL agent.

Tools: list_tables, get_schema, execute_sql.
Each is a LangChain-compatible tool via @tool decorator.
"""

import json

from langchain_core.tools import tool

from chat.services import SQLSecurityError, execute_readonly_query, is_configured
from common.logger import get_logger

logger = get_logger(__name__)

ALLOWED_TABLES = ["transactions"]

_SCHEMA_CACHE: dict[str, str] = {}


@tool
def list_tables() -> str:
    """List all database tables available for querying.

    Returns a JSON list of table names that the agent is allowed to query.
    Use this first to discover which tables exist before writing SQL.
    """
    logger.info("list_tables called")
    return json.dumps(ALLOWED_TABLES)


@tool
def get_schema(table_name: str) -> str:
    """Get the column names and data types for a given table.

    Args:
        table_name: Name of the table to describe (must be one of the allowed tables).

    Returns a JSON list of objects with 'column_name' and 'data_type' keys.
    Use this before writing SQL to know the exact column names and types.
    """
    logger.info("get_schema called for table: %s", table_name)

    if table_name not in ALLOWED_TABLES:
        logger.warning("Table '%s' not in allowed list", table_name)
        return json.dumps({
            "error": f"Table '{table_name}' is not accessible. "
                     f"Allowed tables: {', '.join(ALLOWED_TABLES)}"
        })

    if table_name in _SCHEMA_CACHE:
        logger.info("Returning cached schema for '%s'", table_name)
        return _SCHEMA_CACHE[table_name]

    if not is_configured():
        logger.error("Database not configured for get_schema")
        return json.dumps({
            "error": "Database is not configured. Cannot retrieve schema."
        })

    try:
        rows = execute_readonly_query(
            f"SELECT column_name, data_type "
            f"FROM information_schema.columns "
            f"WHERE table_schema = 'public' AND table_name = '{table_name}' "
            f"ORDER BY ordinal_position",
            max_rows=50,
        )
        logger.info("Schema retrieved: %d columns for '%s'", len(rows), table_name)
        result = json.dumps(rows, default=str)
        _SCHEMA_CACHE[table_name] = result
        return result
    except SQLSecurityError as e:
        logger.error("get_schema failed: %s", e)
        return json.dumps({"error": str(e)})


@tool
def execute_sql(sql: str) -> str:
    """Execute a read-only SQL SELECT query against the database.

    Args:
        sql: A single SELECT statement. Only SELECT queries are allowed.
             INSERT, UPDATE, DELETE, DROP, and other modifying statements
             will be rejected. Results are limited to 500 rows.

    Returns the query results as a JSON string with 'row_count' and 'rows' keys,
    or an error message if the query is invalid or fails.
    """
    logger.info("execute_sql called with query: %s", sql[:200])

    if not is_configured():
        logger.error("Database not configured for execute_sql")
        return json.dumps({
            "error": "Database is not configured. Set DATABASE_URL in .env."
        })

    try:
        rows = execute_readonly_query(sql)
        logger.info("Query returned %d rows", len(rows))
        return json.dumps(
            {"row_count": len(rows), "rows": rows},
            default=str,
        )
    except SQLSecurityError as e:
        logger.error("execute_sql failed: %s", e)
        return json.dumps({"error": str(e)})


ALL_TOOLS = [list_tables, get_schema, execute_sql]
