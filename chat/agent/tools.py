"""
Custom tools for the SQL agent.

Workflow: list_tables → get_table_schema → draft SELECT → query_checker → execute_query.
Also get_current_date for relative dates.

Table catalog: db_config.py (SQL_TABLE_NAMES_LIST, SQL_TABLES_SCHEMA_DICT).
"""

import json
from datetime import datetime, timezone
from typing import List

import psycopg2
import psycopg2.extras
from langchain_core.prompts import PromptTemplate
from langchain_core.tools import tool

from chat.agent.llm import get_llm
from chat.agent.prompt import QUERY_CHECKER_PROMPT_TEMPLATE
from chat.agent.db_config import (
    SQL_DIALECT,
    SQL_TABLE_NAMES_LIST,
    SQL_TABLES_SCHEMA_DICT,
)
from chat.agent.schema import (
    ExecuteQueryInputSchema,
    GetCurrentDateInputSchema,
    GetTableSchemaInputSchema,
    ListTablesInputSchema,
    QueryCheckerInputSchema,
)
from common.database import get_connection, is_database_configured
from common.logger import get_logger

logger = get_logger(__name__)


@tool("list_tables", args_schema=ListTablesInputSchema)
def list_tables(tool_input: str = "") -> str:
    """Input is an empty string; output is a list of table names you may query."""
    logger.info("list_tables called")
    return str(SQL_TABLE_NAMES_LIST)


@tool("get_table_schema", args_schema=GetTableSchemaInputSchema)
def get_table_schema(table_names: List[str]) -> str:
    """
    Input is a list of table names; output is schema and notes for those tables.
    Call list_tables first to ensure the tables exist.
    After this, draft your SELECT in your reasoning, then call query_checker.
    """
    logger.info("get_table_schema called for: %s", table_names)
    if not table_names:
        return "No table names provided. Call list_tables, then pass one or more names."
    parts: list[str] = []
    for i, name in enumerate(table_names):
        if name not in SQL_TABLES_SCHEMA_DICT:
            return (
                f"Unknown table '{name}'. Valid tables: {SQL_TABLE_NAMES_LIST}. "
                "Call list_tables first."
            )
        parts.append(SQL_TABLES_SCHEMA_DICT[name])
        if i < len(table_names) - 1:
            parts.append("\n" + "-" * 80 + "\n")
    return "".join(parts)


@tool("query_checker", args_schema=QueryCheckerInputSchema)
async def query_checker(query: str) -> str:
    """
    Review the draft query before execution. Always call this before execute_query.
    The tool may return corrected SQL; use that string as the input to execute_query.
    """
    logger.info("query_checker called: %s", query[:200])
    try:
        llm = get_llm()
        allowed_tables = ", ".join(SQL_TABLE_NAMES_LIST)
        schema_context = "\n\n".join(
            SQL_TABLES_SCHEMA_DICT[t] for t in SQL_TABLE_NAMES_LIST if t in SQL_TABLES_SCHEMA_DICT
        )
        query_checker_prompt_template = PromptTemplate.from_template(QUERY_CHECKER_PROMPT_TEMPLATE)
        query_checker_prompt = query_checker_prompt_template.format(
            dialect=SQL_DIALECT,
            allowed_tables=allowed_tables,
            schema_context=schema_context,
            query=query.strip(),
        )
        response = await llm.ainvoke(query_checker_prompt)
        return response.content or ""
    except Exception as e:
        logger.error("query_checker failed: %s", e)
        return json.dumps({"error": str(e)})


@tool("execute_query", args_schema=ExecuteQueryInputSchema)
def execute_query(query: str) -> str:
    """
    Run SQL against the database. On error, fix the query with query_checker
    and retry, or call get_table_schema if columns are wrong.
    Prefer passing the SQL returned from query_checker.
    """
    logger.info("execute_query called: %s", query[:200])

    if not is_database_configured():
        logger.error("Database not configured for execute_query")
        return json.dumps(
            {"error": "Database is not configured. Set DATABASE_URL in .env."}
        )

    try:
        # --- pooled connection ---
        with get_connection() as conn:
            # --- execute & fetch ---
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute(query.strip())
                fetched = cur.fetchall()

        rows = [dict(row) for row in fetched]
        logger.info("Query returned %d rows", len(rows))
        return json.dumps({"row_count": len(rows), "rows": rows}, default=str)
    except psycopg2.Error as e:
        logger.error("execute_query failed: %s", e)
        return json.dumps(
            {"error": "Query execution failed. Please check your query and try again."}
        )
    except Exception as e:
        logger.error("execute_query unexpected error: %s", e)
        return json.dumps({"error": "An unexpected error occurred."})


@tool("get_current_date", args_schema=GetCurrentDateInputSchema)
def get_current_date(tool_input: str = "") -> str:
    """Current UTC date and time for relative date questions (e.g. 'this month')."""
    current_time_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    logger.info("get_current_date called")
    return f"The current UTC date and time is: {current_time_utc}"


ALL_TOOLS = [
    list_tables,
    get_table_schema,
    query_checker,
    execute_query,
    get_current_date,
]
