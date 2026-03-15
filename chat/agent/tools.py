"""
Custom tools for the SQL agent.

Tools: list_tables, get_schema, generate_sql, execute_sql.
- get_schema: only fetches table schema (column names, types).
- generate_sql: generates a SELECT query from the user question and schema info.
Each is a LangChain-compatible tool via @tool decorator.
"""

import json
import re

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.tools import tool

from chat.agent.llm import get_llm
from chat.utils.readonly_sql import SQLSecurityError, execute_readonly_query, is_configured
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
    """Fetch the schema only: column names and data types for a given table.

    Does not generate any query. Use this to know exact column names and types
    before calling generate_sql or writing SQL.

    Args:
        table_name: Name of the table (must be one of the allowed tables).

    Returns a JSON list of objects with 'column_name' and 'data_type' keys.
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
            "SELECT column_name, data_type "
            "FROM information_schema.columns "
            "WHERE table_schema = 'public' AND table_name = %s "
            "ORDER BY ordinal_position",
            max_rows=50,
            params=(table_name,),
        )
        logger.info("Schema retrieved: %d columns for '%s'", len(rows), table_name)
        result = json.dumps(rows, default=str)
        _SCHEMA_CACHE[table_name] = result
        return result
    except SQLSecurityError as e:
        logger.error("get_schema failed: %s", e)
        return json.dumps({"error": str(e)})


@tool
def generate_sql(question: str, schema_info: str) -> str:
    """Generate a single SELECT query from the user question and table schema.

    Use the output of get_schema for schema_info. Returns only the SQL string,
    no explanation. The query must be a read-only SELECT; no INSERT/UPDATE/DELETE.

    Args:
        question: The user's natural language question about the data.
        schema_info: JSON string from get_schema (column_name, data_type per column).

    Returns the generated SELECT statement as a string, or a JSON object with
    an 'error' key if generation fails.
    """
    logger.info("generate_sql called for question: %s", question[:80])
    try:
        llm = get_llm()
        system = (
            "You are a SQL generator. Given a user question and a table schema (JSON with "
            "column_name and data_type), output exactly one SELECT statement. "
            "Output only the SQL, no markdown, no explanation, no backticks. "
            "Use only the columns and tables described in the schema. "
            "All amounts are in INR. Return only valid PostgreSQL SELECT."
        )
        messages = [
            SystemMessage(content=system),
            HumanMessage(
                content=f"Question: {question}\n\nSchema:\n{schema_info}\n\nGenerate a single SELECT query:"
            ),
        ]
        response = llm.invoke(messages)
        sql = (response.content or "").strip()
        # Strip markdown code blocks if present
        if sql.startswith("```"):
            sql = re.sub(r"^```\w*\n?", "", sql)
            sql = re.sub(r"\n?```\s*$", "", sql)
        sql = sql.strip()
        if not sql.upper().startswith("SELECT"):
            return json.dumps({"error": "Generated statement is not a SELECT query."})
        return sql
    except Exception as e:
        logger.error("generate_sql failed: %s", e)
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


ALL_TOOLS = [list_tables, get_schema, generate_sql, execute_sql]
