# Personal Finance Tracker

A simple personal finance tracker. All amounts are in **INR (₹)**. Backend is **PostgreSQL** (e.g. Supabase) via `DATABASE_URL`.

## Features

- **FastAPI** — REST API for transactions: create, search, update (PATCH), delete; plus **Chat API** (invoke, resume, exit).
- **Streamlit** — Frontend for transactions management and the finance chat.
- **Dashboard Overview** — A Streamlit overview tab with KPI cards, recent transactions, and a 6-month spending trend bar chart (clean styling, taller chart area, dynamic y-axis headroom of `max + ₹30,000`). Powered by a single consolidated API: `GET /dashboard/overview`.
- **Chat / Finance Assistant** — Natural language questions about your transactions. Uses a LangGraph SQL agent (Gemini LLM) with tools: `list_tables`, `get_table_schema`, `query_checker`, `execute_query`, `get_current_date`. Answers summarize spending, breakdowns by category, and similar queries.
- **Import from CSV** — Bulk-import transactions from a CSV with validation and row-level errors (API: `POST /transactions/import`).
- **Export to CSV** — Export matching transactions as CSV for a date range and optional **category** and **payment method** filters (API: `GET /transactions/export`).
- **Payment method** — Each transaction can record how it was paid (e.g. Cash, UPI, Bank transfer, Card, Wallet, Other). The field is **optional** on create; if omitted, it defaults to **Other**. Enforced allowlist in `tracker.constants.PAYMENT_METHODS`; included in search, CSV import/export, dashboard “recent” items, and chat agent schema (`chat/agent/db_config.py`).
- **Database** — Connects directly to PostgreSQL via `DATABASE_URL` for both tracker (CRUD) and chat (SQL tools). No Supabase client or RLS required for the app. Uses shared SQLAlchemy async engine/session (`asyncpg`).
- **Fixed categories** — Transactions use one of: Grocery, Dining, Transportation, Utilities, Entertainment, Health, Housing, Personal, Investments, Misc, Income, Other Income, Refunds, Travel, Shopping, Subscriptions, Gifts, EMI, Rent (enforced in app and API).
- **Validations** — Shared rules in `tracker.validations`: amount must be > 0, category required, transaction date cannot be in the future; payment method validated when provided (enforced in app and API).
- **Streamlit UI** — Shared coffee-themed styles and form-control alignment in `tracker/ui/common.py` (`apply_theme`). Ledger **Search** supports quick date ranges, filters, and Material-styled actions; **Chat** offers stacked quick-prompt buttons when the thread is empty.
- **Audit fields** — Transactions have `created_at`, `updated_at`, and `version_no`; the app sets them on insert/update (no DB triggers). API and search return and display them.

## Project structure

```
├── app.py                      # Streamlit frontend entrypoint
├── main.py                     # FastAPI app (tracker + chat routers)
├── common/
│   ├── logger.py               # Shared logging config
│   └── database.py             # SQLAlchemy async engine/session helpers
├── tracker/                    # Transaction management
│   ├── models.py               # SQLAlchemy ORM model(s)
│   ├── schemas.py              # Pydantic models (category + payment_method validation)
│   ├── constants.py            # Allowed categories and payment methods
│   ├── validations.py          # Shared validations (amount, category, payment method, date)
│   ├── services.py             # Async CSV export/template/import + dashboard data
│   ├── router/
│   │   ├── transactions.py     # Async transactions API routes
│   │   └── dashboard.py        # Async dashboard overview API
│   └── ui/
│       ├── common.py           # Theme (`apply_theme`), shared UI helpers
│       ├── tabs/
│       │   ├── add_txn_tab.py
│       │   ├── dashboard_tab.py
│       │   └── search_tab.py
│       └── utils/
│           ├── import_csv_section.py   # Import from CSV
│           ├── search_filters.py       # Filters (dates, category, payment method, sort) + Search + Export CSV
│           └── search_results.py      # Results table with edit/delete
├── chat/                       # Finance assistant
│   ├── utils/                  # (reserved for shared chat helpers)
│   ├── router/
│   │   └── chat.py             # Chat API routes (invoke, resume, exit)
│   ├── agent/
│   │   ├── graph.py            # Edgeless StateGraph, run_agent_async()
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
| payment_method     | text                     | NOT NULL | Other              |
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

- **DATABASE_URL** — Postgres connection string (Supabase: Dashboard → Connect → URI). Used by SQLAlchemy async (`postgresql+asyncpg`) for tracker CRUD and Chat SQL tools. `postgresql://` and `postgres://` are normalized automatically.
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

### Dashboard chart behavior

- Spending trend uses an Altair bar chart in `tracker/ui/tabs/dashboard_tab.py`.
- Chart rendering now uses the Streamlit width API: `st.altair_chart(..., width="stretch")`.
- Y-axis domain is explicitly set to `[0, max_spend + 30000]` to keep visual headroom above the tallest bar.

## API endpoints

### Tracker (transactions)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Basic API info |
| POST | `/transactions` | Create a transaction (amount > 0, category required, date not in future; **payment_method** optional, defaults to **Other**). Response includes `created_at`, `updated_at`, `version_no`, `payment_method`. |
| PATCH | `/transactions/{transaction_id}` | Update a transaction (partial); sets `updated_at` and increments `version_no`. |
| DELETE | `/transactions/{transaction_id}` | Delete a transaction. |
| GET | `/transactions/search` | Search transactions by date range, optional **category**, **payment_method** (`All` or a value from `PAYMENT_METHODS`), optional **is_debit**, with pagination and sorting; returns `TransactionsSearchResult` (`total`, `page`, `page_size`, `items`). |
| GET | `/transactions/export` | Export matching transactions as CSV for date range and optional **category** and **payment_method** (same semantics as search filters). |
| POST | `/transactions/import` | Import transactions from CSV bytes; returns `{ "inserted": int, "errors": [str, ...] }`. |

### Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/dashboard/overview` | Returns all Overview tab data in one payload: `summary`, `trend`, `recent`, and `highlights`. Query params: `months` (1-24), `recent_limit` (1-20). |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/invoke` | Run the chat agent. Body: `{ "messages": [ {"role": "user"\|"assistant", "content": "..." } ] }`. Returns `{ "reply": "..." }`. |
| POST | `/chat/resume` | Resume (stub). |
| POST | `/chat/exit` | Exit (stub). |