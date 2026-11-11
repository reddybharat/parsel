# Parsel

Parsel is an INR-focused personal finance tracker: log and search transactions tagged by bank, view spending dashboards, import statements or CSV, export CSV, and ask questions about your data through a conversational assistant.

## Features

- **Dashboard** — monthly spend, category breakdowns, and recent activity; filter by month and bank (overview at `/overview`).
- **Ledger** — search, filter, sort, create, edit, and delete transactions (including by bank); export filtered results to CSV.
- **Bulk import** — CSV template (includes `bank`), plus bank statement import for **SBI** (Excel/PDF), **Kotak** (PDF), and **Slice** (PDF) via the add-transaction flow with review before save.
- **Chat assistant** — natural-language questions over your transaction data, including bank-scoped spend (read-only SQL via Groq + LangGraph).

All amounts are stored and displayed in Indian Rupees (₹). Bank is a label on each transaction (not Open Banking / account aggregation).

## Prerequisites

- **Python** 3.11+ (3.12 recommended)
- **Node.js** 18+ and npm
- **PostgreSQL** running locally (developed on PostgreSQL 18; installer default `C:\Program Files\PostgreSQL\18`)
- **Groq API key**: required only for the chat assistant (`GROQ_API_KEY`)

Commands below are for Windows `cmd`, run from the repo root unless noted. Put the Postgres tools on `PATH` in each new terminal that needs them:

```cmd
set "PATH=%PATH%;C:\Program Files\PostgreSQL\18\bin"
```

## First-time setup

### 1) Database

Create the app login and database (each command asks for the `postgres` password):

```cmd
psql -U postgres -c "CREATE ROLE parsel LOGIN PASSWORD '<parsel-password>';"
createdb -U postgres -O parsel parsel
```

Then either load a backup or build an empty schema. Both are in [`migrations/README.md`](migrations/README.md):

- **Restore a backup:** [Restore from a backup](migrations/README.md#restore-from-a-backup)
- **Empty database:** [Fresh database](migrations/README.md#fresh-database)

Either way, finish by creating the chat agent's read-only login:

```cmd
psql -U postgres -d parsel -f migrations\008_chat_agent_role.sql
psql -U postgres -c "\password parsel_agent"
```

### 2) Backend

```cmd
python -m venv venv
venv\Scripts\activate.bat
pip install -r backend\requirements.txt
copy backend\.env.example backend\.env
notepad backend\.env
```

Fill in `backend\.env` (see [Configuration](#configuration)). To generate a `JWT_SECRET`:

```cmd
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

### 3) Frontend

```cmd
cd frontend
npm install
```

[`frontend/.npmrc`](frontend/.npmrc) sets `legacy-peer-deps=true`: `@shadcn/react` declares React 19 peers while the app is on React 18.

## Run

Use two terminals.

**Backend:**

```cmd
venv\Scripts\activate.bat
cd backend
uvicorn main:app --reload
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Interactive API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

**Frontend:**

```cmd
cd frontend
npm run dev
```

- UI: [http://127.0.0.1:5173](http://127.0.0.1:5173). Vite proxies `/api` to the backend on port 8000.

## Configuration

Environment variables are loaded from `backend/.env` when the API starts (`python-dotenv` in `main.py`).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL URL (`postgresql://…` or `postgresql+asyncpg://…`) |
| `CHAT_DATABASE_URL` | For chat | URL for the read-only `parsel_agent` login (see [`migrations/008_chat_agent_role.sql`](migrations/008_chat_agent_role.sql)). Chat refuses to query when unset |
| `JWT_SECRET` | Yes | Secret key used to sign access tokens (use a long random string) |
| `JWT_EXPIRE_MINUTES` | No | Access token lifetime in minutes (default: `10`) |
| `ENV` | No | Set to `production` to disable `/docs`, `/redoc`, and `/openapi.json` |
| `GROQ_API_KEY` | For chat | Groq API key for the chat assistant |
| `GROQ_MODEL` | No | Groq model id (default: `openai/gpt-oss-120b`) |
| `CORS_ORIGINS` | No | Comma-separated allowed frontend origins (default includes `http://localhost:5173` and `http://127.0.0.1:5173`) |

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and fill it in. Minimal example:

```env
DATABASE_URL=postgresql://parsel:password@localhost:5432/parsel
CHAT_DATABASE_URL=postgresql://parsel_agent:password2@localhost:5432/parsel
JWT_SECRET=replace-with-a-long-random-string
GROQ_API_KEY=your_groq_key_here
```

## Database

Schema SQL lives in [`migrations/`](migrations/). There is no migration runner; apply scripts with `psql`. The app connects as `parsel` (owns the database, not a superuser); the chat assistant connects as `parsel_agent` (`SELECT` on `transactions` only, read-only).

| Script | When |
|---|---|
| [`migrations/001_initial_transactions.sql`](migrations/001_initial_transactions.sql) | Fresh DB: original `transactions` table (pre-auth baseline) |
| [`migrations/002_users_and_transaction_user_id.sql`](migrations/002_users_and_transaction_user_id.sql) | Add `users` + `transactions.user_id` (multi-user auth) |
| [`migrations/003_search_indexes.sql`](migrations/003_search_indexes.sql) … [`007_user_banks.sql`](migrations/007_user_banks.sql) | Search indexes, category prefs, non-spend indexes, `transactions.bank`, `user_banks` |
| [`migrations/008_chat_agent_role.sql`](migrations/008_chat_agent_role.sql) | Read-only `parsel_agent` login for the chat assistant (run as `postgres`) |

See [`migrations/README.md`](migrations/README.md) for the exact order, backfill steps, verification queries, and [backups](migrations/README.md#backups).

Allowed `payment_method` and `bank` values are enforced by the API and match `backend/tracker/constants.py` (banks: SBI, Kotak, Slice). Categories are system defaults from that file plus up to 10 custom labels stored in each user's preferences (no categories table). CSV export/import columns include `bank`; a per-row CSV `bank` overrides the form-selected bank when present.

## Auth

- `POST /auth/register` — `{ username, email, password }` (username 3–32: letters/numbers/`_`; password min 8); returns a JWT.
- `POST /auth/login` — `{ login, password }` where `login` is username or email; returns a JWT.
- `POST /auth/refresh` — requires a still-valid Bearer token; returns a fresh JWT (extends the session).
- All tracker, dashboard, config, and chat routes require `Authorization: Bearer <token>`.
- Each user only sees and mutates their own transactions.

## UI routes

| Path | Page |
|---|---|
| `/login` | Sign in |
| `/register` | Create account |
| `/overview` | Dashboard |
| `/ledger/search` | Transaction search and management |
| `/ledger/add` | Add / import transactions (CSV or bank statement) |
| `/chat` | Finance chat assistant |

## API documentation

- **Interactive docs** — [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) (OpenAPI / Swagger UI)
- **Architecture and route boundaries** — [ARCHITECTURE.md](ARCHITECTURE.md)

## Production build

```cmd
cd frontend
npm run build
```

Serve the contents of `frontend/dist` behind your web server. Point `VITE_API_BASE_URL` at your deployed API (or configure the server to proxy `/api` to the backend the same way Vite does in development).

## Testing

With the virtual environment activated:

```cmd
cd backend
python -m pytest -q
```

Use `python -m pytest`, not bare `pytest`: it puts `backend` on the import path.

Most tests mock the database and the LLM. [`tests/test_chat_agent_role.py`](backend/tests/test_chat_agent_role.py) runs against the real database through `CHAT_DATABASE_URL` and checks that the chat agent can read `transactions` but cannot write or read `users`; it is skipped when `CHAT_DATABASE_URL` is unset.

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — backend/frontend layout, runtime flow, and API boundaries