"""
Static SQL catalog for the chat agent.

The agent calls list_tables and get_table_schema to discover tables and columns.
Keep this file in sync with your database when you add or change tables.
"""

from tracker.constants import BANKS, PAYMENT_METHODS, SYSTEM_CATEGORIES

# Dialect label for query_checker (see QUERY_CHECKER_PROMPT_TEMPLATE in prompt.py)
SQL_DIALECT = "sqlite"

# Exposed to the agent (must match keys in SQL_TABLES_SCHEMA_DICT)
SQL_TABLE_NAMES_LIST = ["transactions"]

# Human-readable schema and notes per table. Used by get_table_schema.
SQL_TABLES_SCHEMA_DICT: dict[str, str] = {
    "transactions": f"""
Table: transactions

Columns:
- id                  text PRIMARY KEY  — uuid
- user_id             text NOT NULL  — uuid; filter only (see system prompt CURRENT USER)
- amount              real NOT NULL  — INR, always > 0
- is_debit            integer NOT NULL  — 1 = outflow (show as (₹…)), 0 = inflow (show as ₹…); never show the boolean
- category            text NOT NULL     — free text; system defaults include: {", ".join(SYSTEM_CATEGORIES)}; custom labels appear when used; match case-insensitively when helpful
- payment_method      text NULL        — one of: {", ".join(PAYMENT_METHODS)} when set
- bank                text NULL        — one of: {", ".join(BANKS)} when set; older rows may be null
- transaction_date    text NOT NULL  — 'YYYY-MM-DD'
- description         text NULL
- created_at          text NOT NULL  — UTC 'YYYY-MM-DD HH:MM:SS'
- updated_at          text NOT NULL  — UTC 'YYYY-MM-DD HH:MM:SS'
- version_no          integer NOT NULL

Notes:
- Amounts are INR. 'Investments', 'Self Transfer', and 'Wallet Top-up' are excluded from spending.
- Only 'Investments' counts as investments; the transfer categories are not investments.
- There is no separate categories table; category is stored as text on each row.

SQLite syntax (this database is SQLite, not PostgreSQL):
- One month: transaction_date >= '2026-07-01' AND transaction_date < '2026-08-01'
- Group by month: strftime('%Y-%m', transaction_date); by year: strftime('%Y', transaction_date)
- Weekday: strftime('%w', transaction_date) is '0' (Sunday) to '6' (Saturday); weekends: IN ('0', '6')
- Relative dates: date('now', 'start of month'), date('now', '-30 days'), date('now', 'start of month', '-1 month')
- Text search: description LIKE '%swiggy%' (case-insensitive for English letters)
- Debits: is_debit = 1; credits: is_debit = 0
- Casts: CAST(x AS REAL), CAST(x AS INTEGER); rounding: ROUND(x, 2)
- Not available: date_trunc, EXTRACT, ILIKE, :: casts, to_char, NOW(), INTERVAL, DISTINCT ON
""".strip(),
}
