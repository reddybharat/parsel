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
- **PostgreSQL** with a database you can connect to via `DATABASE_URL`
- **Groq API key** — required only for the chat assistant (`GROQ_API_KEY`)

## Quick start

Run the backend and frontend in separate terminals.

### 1) Backend

Create `backend/.env` (see [Configuration](#configuration)) with at least `DATABASE_URL`, then:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- Interactive API docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

- UI: [http://127.0.0.1:5173](http://127.0.0.1:5173)


## Configuration

Environment variables are loaded from `backend/.env` when the API starts (`python-dotenv` in `main.py`).

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL URL (`postgresql://…` or `postgresql+asyncpg://…`) |
| `JWT_SECRET` | Yes | Secret key used to sign access tokens (use a long random string) |
| `JWT_EXPIRE_MINUTES` | No | Access token lifetime in minutes (default: `10`) |
| `ENV` | No | Set to `production` to disable `/docs`, `/redoc`, and `/openapi.json` |
| `GROQ_API_KEY` | For chat | Groq API key for the chat assistant |
| `GROQ_MODEL` | No | Groq model id (default: `llama-3.3-70b-versatile`) |
| `CORS_ORIGINS` | No | Comma-separated allowed frontend origins (default includes `http://localhost:5173` and `http://127.0.0.1:5173`) |

Example `backend/.env`:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/parsel
JWT_SECRET=replace-with-a-long-random-string
GROQ_API_KEY=your_groq_key_here
```

## Database

Schema SQL lives in [`migrations/`](migrations/). There is no migration runner; apply scripts with `psql` (or any Postgres client) against the database in `DATABASE_URL`.

| Script | When |
|---|---|
| [`migrations/001_initial_transactions.sql`](migrations/001_initial_transactions.sql) | Fresh DB — original `transactions` table (pre-auth baseline) |
| [`migrations/002_users_and_transaction_user_id.sql`](migrations/002_users_and_transaction_user_id.sql) | Add `users` + `transactions.user_id` (multi-user auth) |
| [`migrations/003_search_indexes.sql`](migrations/003_search_indexes.sql) … [`006_transaction_bank.sql`](migrations/006_transaction_bank.sql) | Search indexes, category prefs, non-spend indexes, `transactions.bank` |

See [`migrations/README.md`](migrations/README.md) for the exact order, backfill steps, and verification queries.

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

```powershell
cd frontend
npm run build
```

Serve the contents of `frontend/dist` behind your web server. Point `VITE_API_BASE_URL` at your deployed API (or configure the server to proxy `/api` to the backend the same way Vite does in development).

## Testing

From `backend` with the virtual environment activated:

```powershell
python -m pytest tests/ -v
```

Chat tests mock the agent and do not require `GROQ_API_KEY` or a live database.

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — backend/frontend layout, runtime flow, and API boundaries