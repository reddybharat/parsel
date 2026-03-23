# Personal Finance Tracker

A simple personal finance tracker. All amounts are in **INR (₹)**. Backend is **PostgreSQL** (e.g. Supabase) via `DATABASE_URL`.

## Features

- **FastAPI** — REST API for transactions: create, search, update (PATCH), delete; plus **Chat API** (invoke, resume, exit).
- **Streamlit** — Frontend for transactions management and the finance chat.
- **Chat / Finance Assistant** — Natural language questions about your transactions. Uses a LangGraph SQL agent (Gemini LLM) with tools: `list_tables`, `get_table_schema`, `query_checker`, `execute_query`, `get_current_date`. Answers summarize spending, breakdowns by category, and similar queries.
- **Import from CSV** — Bulk-import transactions from a CSV with validation and row-level errors (API: `POST /transactions/import`).
- **Export to CSV** — Export matching transactions as CSV for a date range and optional category (API: `GET /transactions/export`).
- **Database** — Connects directly to PostgreSQL via `DATABASE_URL` for both tracker (CRUD) and chat (SQL tools). No Supabase client or RLS required for the app. A shared connection pool is used for API and Chat.
- **Fixed categories** — Transactions use one of: Grocery, Dining, Transportation, Utilities, Entertainment, Health, Housing, Personal, Investments, Misc, Income, Other Income, Refunds, Travel, Shopping, Subscriptions, Gifts, EMI, Rent (enforced in app and API)
- **Validations** — Shared rules in `tracker.validations`: amount must be > 0, category required, transaction date cannot be in the future (enforced in app and API)
- **Audit fields** — Transactions have `created_at`, `updated_at`, and `version_no`; the app sets them on insert/update (no DB triggers). API and search return and display them.

## Project structure

```
├── app.py                      # Streamlit frontend entrypoint
├── main.py                     # FastAPI app (tracker + chat routers)
├── common/
│   ├── logger.py               # Shared logging config
│   └── database.py             # Postgres connection only (session, get_connection)
├── tracker/                    # Transaction management
│   ├── utils/
│   │   └── db.py               # Execute helpers (query, insert, update, delete)
│   ├── schemas.py              # Pydantic models (with category validation)
│   ├── constants.py            # Allowed categories list
│   ├── validations.py          # Shared validations (amount, category, date)
│   ├── services.py             # CSV export, template, import
│   ├── router.py               # Transaction API routes (search, create, update, delete, CSV export/import)
│   └── ui/
│       ├── common.py           # Shared frontend helpers
│       ├── tabs/
│       │   ├── add_txn_tab.py
│       │   └── search_tab.py
│       └── utils/
│           ├── import_csv_section.py   # Import from CSV
│           ├── search_filters.py       # Date/category/sort + Search + Export to CSV
│           └── search_results.py      # Results table with edit/delete
├── chat/                       # Finance assistant
│   ├── utils/                  # (reserved for shared chat helpers)
│   ├── router.py               # Chat API routes (invoke, resume, exit)
│   ├── agent/
│   │   ├── graph.py            # Edgeless StateGraph, run_agent()
│   │   ├── nodes.py            # agent_node (create_agent + tools)
│   │   ├── tools.py            # list_tables, get_table_schema, query_checker, execute_query, get_current_date
│   │   ├── db_config.py        # Table names + schema text for tools
│   │   ├── schema.py           # Pydantic args_schema for tools
│   │   ├── state.py            # AgentState (messages)
│   │   ├── prompt.py           # System prompt + query_checker template
│   │   └── llm.py              # Gemini LLM (get_llm)
│   └── ui/
│       └── chat_tab.py         # Chat frontend, calls FastAPI chat router via HTTP client
├── tests/
│   ├── test_tracker_database.py
│   ├── test_tracker_transactions_api.py
│   ├── test_tracker_services_csv.py
│   ├── test_chat_api.py
│   └── test_ui_smoke.py
├── ARCHITECTURE.md              # High-level architecture, runtime flow, and packages
├── requirements.txt
└── .env                         # (create from example below; not committed)
```

## Table schema

`public.transactions`:

| Column             | Type                     | Nullable | Default            |
|--------------------|--------------------------|----------|--------------------|
| id                 | uuid                     | NOT NULL | gen_random_uuid()  |
| created_at         | timestamp with time zone | NOT NULL | now()              |
| amount             | numeric                  | NOT NULL | —                  |
| is_debit           | boolean                  | NOT NULL | true               |
| category           | text                     | NOT NULL | —                  |
| transaction_date   | date                     | NOT NULL | —                  |
| description        | text                     | NULL     | —                  |
| updated_at         | timestamp with time zone | NOT NULL | now()              |
| version_no         | integer                  | NOT NULL | 0                  |

Primary key: `id`.

## Setup

### Prerequisites

- Python 3.8+
- A [Supabase](https://supabase.com) (or other PostgreSQL) project with a `transactions` table (see schema above)
- For the **Chat** tab: a [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key) API key (Gemini)

### 1. Clone and virtual environment

```bash
cd personal_finance_tracker
python -m venv venv
```

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```

**macOS/Linux:**
```bash
source venv/bin/activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt
```

### 3. Environment variables

Create a `.env` in the project root:

```env
GOOGLE_API_KEY=your-gemini-api-key
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

- **DATABASE_URL** — Postgres connection string (Supabase: Dashboard → Connect → URI). Used for all tracker CRUD and for the Chat agent’s read-only SQL. If the password contains special characters (e.g. `#`), URL-encode them.
- **GOOGLE_API_KEY** — From [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key). Required for the Chat (Finance Assistant) tab.

### 4. Run the app

**API server:**

```bash
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000  
- Interactive docs: http://127.0.0.1:8000/docs  

**Streamlit frontend (in a second terminal):**

```bash
streamlit run app.py
```

Opens at http://localhost:8501.

## API endpoints

### Tracker (transactions)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Basic API info |
| POST | `/transactions` | Create a transaction (amount > 0, category required, date not in future). Response includes `created_at`, `updated_at`, `version_no`. |
| PATCH | `/transactions/{transaction_id}` | Update a transaction (partial); sets `updated_at` and increments `version_no`. |
| DELETE | `/transactions/{transaction_id}` | Delete a transaction. |
| GET | `/transactions/search` | Search transactions by date range/category with pagination and sorting; returns `TransactionsSearchResult` wrapper with `total`, `page`, `page_size`, and `items` (list of `TransactionResponse`). |
| GET | `/transactions/export` | Export matching transactions for the current filters (date range and category) as CSV. |
| POST | `/transactions/import` | Import transactions from CSV bytes; returns `{ "inserted": int, "errors": [str, ...] }`. |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/invoke` | Run the chat agent. Body: `{ "messages": [ {"role": "user"\|"assistant", "content": "..." } ] }`. Returns `{ "reply": "..." }`. |
| POST | `/chat/resume` | Resume (stub). |
| POST | `/chat/exit` | Exit (stub). |