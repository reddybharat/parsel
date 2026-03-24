"""
Static SQL catalog for the chat agent.

The agent calls list_tables and get_table_schema to discover tables and columns.
Keep this file in sync with your database when you add or change tables.
"""

from tracker.constants import CATEGORIES

# Dialect label for query_checker (see QUERY_CHECKER_PROMPT_TEMPLATE in prompt.py)
SQL_DIALECT = "postgresql"

# Exposed to the agent (must match keys in SQL_TABLES_SCHEMA_DICT)
SQL_TABLE_NAMES_LIST = ["transactions"]

# Human-readable schema and notes per table. Used by get_table_schema.
SQL_TABLES_SCHEMA_DICT: dict[str, str] = {
    "transactions": f"""
Table: public.transactions

Columns:
- id                  uuid PRIMARY KEY (default gen_random_uuid())
- amount              numeric NOT NULL  — transaction amount in INR (always > 0)
- is_debit            boolean NOT NULL  — True for Debit (spend), False for Credit (income)
- category            text NOT NULL     — one of: {", ".join(CATEGORIES)}
- transaction_date    date NOT NULL
- description         text NULL
- created_at          timestamptz NOT NULL
- updated_at          timestamptz NOT NULL
- version_no          integer NOT NULL

Notes:
- Amounts are in Indian Rupees (INR).
- The app treats Debit as a negative signed value for display (using is_debit).
- For spending vs investments: treat "Investments" category as investments, not ordinary spending unless the user asks for investments specifically.
""".strip(),
}
