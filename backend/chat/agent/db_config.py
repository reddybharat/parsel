"""
Static SQL catalog for the chat agent.

The agent calls list_tables and get_table_schema to discover tables and columns.
Keep this file in sync with your database when you add or change tables.
"""

from tracker.constants import PAYMENT_METHODS, SYSTEM_CATEGORIES

# Dialect label for query_checker (see QUERY_CHECKER_PROMPT_TEMPLATE in prompt.py)
SQL_DIALECT = "postgresql"

# Exposed to the agent (must match keys in SQL_TABLES_SCHEMA_DICT)
SQL_TABLE_NAMES_LIST = ["transactions"]

# Human-readable schema and notes per table. Used by get_table_schema.
SQL_TABLES_SCHEMA_DICT: dict[str, str] = {
    "transactions": f"""
Table: public.transactions

Columns:
- id                  uuid PRIMARY KEY
- user_id             uuid NOT NULL  — filter only (see system prompt CURRENT USER)
- amount              numeric NOT NULL  — INR, always > 0
- is_debit            boolean NOT NULL  — true = outflow (show as (₹…)), false = inflow (show as ₹…); never show the boolean
- category            text NOT NULL     — free text; system defaults include: {", ".join(SYSTEM_CATEGORIES)}; custom labels appear when used; match case-insensitively when helpful
- payment_method      text NULL        — one of: {", ".join(PAYMENT_METHODS)} when set
- transaction_date    date NOT NULL
- description         text NULL
- created_at          timestamptz NOT NULL
- updated_at          timestamptz NOT NULL
- version_no          integer NOT NULL

Notes:
- Amounts are INR. Investments category is 'Investments'.
- There is no separate categories table; category is stored as text on each row.
""".strip(),
}
