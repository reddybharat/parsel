# Personal Finance Tracker

A simple personal finance tracker. All amounts are in **INR (₹)**. Backend is **PostgreSQL** (e.g. Supabase) via `DATABASE_URL`.

## Features

- **FastAPI** — REST API for transactions: create, list, get by id, update (PATCH), delete, and current-month summary; plus **Chat API** (invoke, resume, exit)
- **Streamlit** — Tabbed UI: **Add** (form + **Import from CSV**), **Search** (filter by date range/category, pagination, **Export to CSV**, edit and delete per transaction), **Chat** (Finance Assistant). Summary tab is present in code but hidden from the UI for now.
- **Chat / Finance Assistant** — Natural language questions about your transactions. Uses a LangGraph SQL agent (Gemini LLM) with tools: list tables, get schema, execute read-only SQL. Answers summarize spending, breakdowns by category, and similar queries.
- **Import from CSV** — In the **Add** tab: download a template (correct headers + example rows), upload a CSV, and bulk-import transactions. Columns: `transaction_date` (YYYY-MM-DD), `category`, `amount`, `description` (optional). Category must be one of the fixed list; validation and row-level errors are shown.
- **Export to CSV** — In the **Search** tab: after you run a search, an **Export to CSV** button appears next to the Search button and downloads all transactions matching the current filters (date range and category).
- **Database** — Connects directly to PostgreSQL via `DATABASE_URL` for both tracker (CRUD) and chat (read-only SQL). No Supabase client or RLS required for the app.
- **Fixed categories** — Transactions use one of: Grocery, Dining, Transportation, Utilities, Entertainment, Health, Housing, Personal, Investments, Misc (enforced in UI and API)
- **Validations** — Shared rules in `tracker.validations`: amount must be > 0, category required, transaction date cannot be in the future (enforced in UI and API)

## Prerequisites

- Python 3.8+
- A [Supabase](https://supabase.com) (or other PostgreSQL) project with a `transactions` table
- For the **Chat** tab: a [Google AI Studio](https://ai.google.dev/gemini-api/docs/api-key) API key (Gemini)

### Table schema

`transactions` should have at least: `id`, `amount`, `category`, `transaction_date`, `description`.

## Setup

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

### 4. Row Level Security (optional)

If your table has RLS enabled and you use the Supabase client elsewhere, you can run the policies in **Supabase Dashboard → SQL Editor** using `supabase_rls_policies.sql`. The app uses a direct Postgres connection and does not require RLS for normal operation.

## Running the app

### API server

```bash
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000  
- Interactive docs: http://127.0.0.1:8000/docs  

### Streamlit UI

```bash
streamlit run app.py
```

Opens at http://localhost:8501. Three tabs (Summary hidden for now):

- **Add** — Form: amount, category (required), date (today or past only), optional description. **Import from CSV** expander: download template, upload CSV, import (with validation and error report)
- **Search** — Filter by date range, optional category, sort, and per-page count. **Search** and **Export to CSV** buttons side by side; Export appears after you run a search and downloads all results for the current filters. Table supports edit and delete per transaction
- **Chat** — Finance Assistant: ask questions in plain English (e.g. “What is my total spend this month?”, “Spending by category”). The agent uses Gemini and read-only SQL against your `transactions` table and returns summarized answers

## API endpoints

### Tracker (transactions)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Basic API info |
| POST | `/transactions` | Create a transaction (amount > 0, category required, date not in future) |
| GET | `/transactions` | List last 20 transactions |
| GET | `/transactions/{transaction_id}` | Get one transaction by id |
| PATCH | `/transactions/{transaction_id}` | Update a transaction (partial) |
| DELETE | `/transactions/{transaction_id}` | Delete a transaction |
| GET | `/summary` | Current month total and spend by category |

### Chat

| Method | Path | Description |
|--------|------|-------------|
| POST | `/chat/invoke` | Run the chat agent. Body: `{ "messages": [ {"role": "user"\|"assistant", "content": "..." } ] }`. Returns `{ "reply": "..." }` |
| POST | `/chat/resume` | Resume (stub) |
| POST | `/chat/exit` | Exit (stub) |

## Project structure

```
├── app.py                      # Streamlit UI (tabs: Add, Search, Chat)
├── main.py                     # FastAPI app (tracker + chat routers)
├── common/
│   └── logger.py               # Shared logging config
├── tracker/                    # Transaction management
│   ├── database.py             # Postgres CRUD via DATABASE_URL
│   ├── schemas.py              # Pydantic models (with category validation)
│   ├── constants.py            # Allowed categories list
│   ├── validations.py          # Shared validations (amount, category, date)
│   ├── services.py             # CSV export, template, import
│   ├── api/
│   │   └── transactions.py     # Transaction & summary routes
│   └── ui/
│       ├── common.py           # Shared UI helpers
│       ├── tabs/
│       │   ├── summary_tab.py  # (hidden for now)
│       │   ├── add_txn_tab.py
│       │   └── search_tab.py
│       └── utils/
│           ├── import_csv_section.py   # Import from CSV (Add tab)
│           ├── search_filters.py       # Date/category/sort + Search + Export to CSV
│           └── search_results.py      # Results table with edit/delete
├── chat/                       # Finance assistant
│   ├── services.py             # Read-only SQL executor (guardrails, psycopg2)
│   ├── api/
│   │   └── chat.py             # invoke, resume, exit endpoints
│   ├── agent/
│   │   ├── graph.py            # Edgeless StateGraph, run_agent()
│   │   ├── nodes.py            # agent_node (create_agent + tools)
│   │   ├── tools.py            # list_tables, get_schema, execute_sql
│   │   ├── state.py            # AgentState (messages)
│   │   ├── prompt.py           # System prompt for the agent
│   │   └── llm.py              # Gemini LLM (get_llm)
│   └── ui/
│       └── chat_tab.py         # Chat UI, invokes agent
├── requirements.txt
└── supabase_rls_policies.sql
```
