# Personal Finance Tracker

Personal finance tracker in **INR (₹)**. **FastAPI** backend + **Streamlit** UI over **PostgreSQL** (`DATABASE_URL`). Optional **Groq**-powered chat assistant queries the same database.

---

## Quick Start / How to Run

```powershell
cd personal_finance_tracker
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Create `.env` in the project root (see [Environment variables](#environment-variables) below).

**Terminal 1 — API**

```bash
uvicorn main:app --reload
```

- API: http://127.0.0.1:8000  
- OpenAPI docs: http://127.0.0.1:8000/docs  

**Terminal 2 — Streamlit UI**

```bash
streamlit run app.py
```

- UI: http://localhost:8501  
- Tabs: **Overview** (dashboard), **Ledger** (search / add / CSV import-export), **AI Chat** (requires `GROQ_API_KEY`)

**Prerequisites:** Python 3.8+, PostgreSQL with a `public.transactions` table (schema in [Database](#database)), and a [Groq API key](https://console.groq.com/keys) for the chat tab.

---

## How to Test

There is no automated test suite in the repo yet (`pytest` is listed in `requirements.txt` for future use). Verify manually:

**API health**

```bash
curl http://127.0.0.1:8000/
```

Expected: JSON with `"message": "Personal Finance Tracker API"` and `"docs": "/docs"`.

**Dashboard overview** (requires `DATABASE_URL` and data)

```bash
curl "http://127.0.0.1:8000/dashboard/overview?months=6&recent_limit=5"
```

**Chat invoke** (requires `GROQ_API_KEY`)

```bash
curl -X POST http://127.0.0.1:8000/chat/invoke ^
  -H "Content-Type: application/json" ^
  -d "{\"messages\":[{\"role\":\"user\",\"content\":\"What did I spend on groceries last month?\"}]}"
```

On macOS/Linux, use `\` instead of `^` for line continuation, or send the JSON on one line.

**UI smoke test:** With both processes running, open the Streamlit app → **Overview** loads KPIs/chart → **Ledger** → Search runs → **AI Chat** returns a reply.

---

## Environment variables

Create `.env` at the project root. Loaded by `main.py` and `app.py` via `python-dotenv`.

| Variable Name | Description | Example Value |
|---------------|-------------|---------------|
| `DATABASE_URL` | **Required** for tracker CRUD, dashboard, CSV import/export, and chat SQL tools. `postgresql://` and `postgres://` are normalized to `postgresql+asyncpg://` automatically. | `postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres` |
| `GROQ_API_KEY` | **Required** for the AI Chat tab and `POST /chat/invoke`. | `gsk_...` |
| `GROQ_MODEL` | Optional Groq model id. Default: `llama-3.3-70b-versatile`. | `llama-3.3-70b-versatile` |
| `API_BASE_URL` | Base URL the Streamlit UI uses to call FastAPI (`common.api_client`). | `http://localhost:8000` |
| `LOG_LEVEL` | Logging level for `common.logger` (`DEBUG`, `INFO`, `WARNING`, `ERROR`). Default: `INFO`. | `INFO` |

---

## Architecture & project layout

```
personal_finance_tracker/
├── main.py                 # FastAPI entrypoint (transactions, dashboard, chat routers)
├── app.py                  # Streamlit entrypoint (Overview, Ledger, AI Chat)
├── common/                 # Shared DB engine/session, HTTP client, logging
├── tracker/                # Transactions CRUD, validations, CSV, dashboard API + UI
│   ├── router/             # FastAPI: /transactions, /dashboard/overview
│   ├── ui/                 # Streamlit tabs and ledger helpers
│   ├── models.py           # SQLAlchemy ORM
│   └── services.py         # Dashboard SQL, CSV import/export
├── chat/                   # LangGraph SQL agent + /chat API + Streamlit chat tab
│   ├── router/             # FastAPI: /chat/invoke, resume, exit
│   └── agent/              # Groq LLM, tools, prompts, graph
├── ARCHITECTURE.md         # Deeper design notes and package boundaries
└── requirements.txt
```

**Runtime split:** Streamlit never talks to Postgres directly. It calls FastAPI over HTTP (`common.api_client` → `tracker.client` / `chat.client`). FastAPI and the chat agent share one async SQLAlchemy stack in `common/database.py`.

**Amounts:** INR everywhere; negatives shown in accounting parentheses in the UI (`format_inr_signed` in `tracker/ui/common.py`).

---

## Runtime flow

```mermaid
graph LR
  UI[Streamlit app.py] --> HTTP[common.api_client]
  HTTP --> API[FastAPI main.py]
  API --> T[tracker routers]
  API --> C[chat router]
  T --> DB[(PostgreSQL)]
  C --> Agent[LangGraph agent]
  Agent --> DB
```

---

## Database

`public.transactions` (amounts in INR; app sets audit fields on write — no DB triggers):

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK, default `gen_random_uuid()` |
| `amount` | numeric | Must be &gt; 0 |
| `is_debit` | boolean | Default `true` |
| `category` | text | Fixed allowlist in `tracker/constants.py` |
| `payment_method` | text | Default `Other`; allowlist in `PAYMENT_METHODS` |
| `transaction_date` | date | Cannot be in the future |
| `description` | text | Optional |
| `created_at`, `updated_at` | timestamptz | Set by app |
| `version_no` | integer | Incremented on update |

---

## API reference

Full interactive docs: http://127.0.0.1:8000/docs

| Area | Method | Path | Purpose |
|------|--------|------|---------|
| Root | GET | `/` | API info |
| Transactions | POST | `/transactions` | Create |
| Transactions | PATCH | `/transactions/{id}` | Partial update |
| Transactions | DELETE | `/transactions/{id}` | Delete |
| Transactions | GET | `/transactions/search` | Filtered search + pagination |
| Transactions | GET | `/transactions/export` | CSV export |
| Transactions | POST | `/transactions/import` | CSV import |
| Dashboard | GET | `/dashboard/overview` | KPIs, trend, recent rows (`months`, `recent_limit`) |
| Chat | POST | `/chat/invoke` | Natural-language query over transactions |
| Chat | POST | `/chat/resume`, `/chat/exit` | Stubs |

More detail: [ARCHITECTURE.md](ARCHITECTURE.md).
