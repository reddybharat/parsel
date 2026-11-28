# Parsel

Parsel is an INR-focused personal finance tracker: log and search transactions tagged by bank, view spending dashboards, import statements or CSV, export CSV, and ask questions about your data through a conversational assistant.

## Features

- **Dashboard** — monthly spend, category breakdowns, and recent activity; filter by month and bank (overview at `/overview`).
- **Ledger** — search, filter, sort, create, edit, and delete transactions (including by bank); export filtered results to CSV.
- **Bulk import** — CSV template (includes `bank`), plus bank statement import for **SBI** (Excel/PDF), **Kotak** (PDF), and **Slice** (PDF) via the add-transaction flow with review before save. Blank statement categories are pre-filled from your past transactions (see [Category suggestions](#category-suggestions)).
- **Chat assistant** — natural-language questions over your transaction data, including bank-scoped spend (read-only SQL via Groq + LangGraph).

All amounts are stored and displayed in Indian Rupees (₹). Bank is a label on each transaction (not Open Banking / account aggregation).

## Quick setup

No coding needed. You need an internet connection and about 10 minutes. Everything Parsel stores stays in one file on your computer (`data/parsel.db`); there is no database server to install.

### 1. Get Parsel

**Recommended, with Git** (makes updating one step). Install Git ([git-scm.com](https://git-scm.com/downloads); on a Mac it is offered automatically the first time you type `git`), then in a terminal:

```cmd
git clone -b release https://github.com/reddybharat/parsel.git
```

**Or download the zip** from GitHub (pick the `release` branch first) and unzip it somewhere easy to find, like Documents.

### 2. Run setup once

| Your computer | Do this |
|---|---|
| Windows | Double-click `run-parsel\windows\setup.bat` |
| Mac | Double-click `run-parsel/macos/setup.command`. If macOS says it can't be opened, right-click it, choose **Open**, then **Open** again |
| Linux (Ubuntu 24.04+, Debian 12+) | In a terminal in the Parsel folder: `bash run-parsel/linux/setup.sh` |

Setup prints each step (`[1/5] Python 3.11+ ... found 3.12.4`) and, if one fails, what to do about it.

- Missing Python or Node.js is installed for you: winget on Windows, Homebrew on a Mac (setup tells you how to get Homebrew if you don't have it), apt on Linux (asks for your password). Other Linux systems, or releases too old to have Python 3.11 and Node.js 18, get a message pointing to python.org and nodejs.org.
- It asks for a Groq API key, free at [console.groq.com/keys](https://console.groq.com/keys). Only the chat assistant and the Overview insight sentence use it; press Enter to skip. Add one later by pasting it after `GROQ_API_KEY=` in `backend/.env`, then restarting Parsel.

### 3. Every time you use Parsel

Start it with `run-parsel\windows\start.bat` (Windows), `run-parsel/macos/start.command` (Mac) or `bash run-parsel/linux/start.sh` (Linux). Your browser opens at [http://localhost:5173](http://localhost:5173) once it's ready; register an account the first time. Keep the window open while you use Parsel, and close it (or press Ctrl+C) to stop.

### Updating

Run setup again. It downloads the latest `release` code, restarts itself, updates packages, and upgrades your database (after backing it up). It skips anything already done and keeps your settings and data.

If you downloaded the zip instead of using Git: download the new zip, unzip it, copy the `data` folder (and `backend/.env`) from your old Parsel folder into the new one, run setup in the new folder, and only then delete the old folder. **Your data lives in `data/`; deleting it without copying deletes your transactions.**

Backups and restores are in [`migrations/README.md`](migrations/README.md#backups). Coming from the old PostgreSQL version: see [Moving from Postgres](migrations/README.md#moving-from-postgres).

The rest of this README is the manual setup, for developers.

## Prerequisites

- **Python** 3.11+ (3.12 recommended), whose built-in SQLite is 3.35+ (every python.org build is)
- **Node.js** 18+ and npm
- **Groq API key**: only for the chat assistant and the Overview insight (`GROQ_API_KEY`)

Commands below are for Windows `cmd`, run from the repo root unless noted.

## First-time setup

### 1) Database

Nothing to do: the API creates `data\parsel.db` and applies [`migrations/`](migrations/) on startup.

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
| `JWT_SECRET` | Yes | Secret key used to sign access tokens (use a long random string) |
| `DATABASE_PATH` | No | Absolute path of the SQLite file (default: `<repo>/data/parsel.db`) |
| `JWT_EXPIRE_MINUTES` | No | Access token lifetime in minutes (default: `10`) |
| `ENV` | No | Set to `production` to disable `/docs`, `/redoc`, and `/openapi.json` |
| `GROQ_API_KEY` | For chat | Groq API key for the chat assistant and Overview insight |
| `GROQ_MODEL` | No | Groq model id (default: `openai/gpt-oss-120b`) |
| `CORS_ORIGINS` | No | Comma-separated allowed frontend origins (default includes `http://localhost:5173` and `http://127.0.0.1:5173`) |

Copy [`backend/.env.example`](backend/.env.example) to `backend/.env` and fill it in. Minimal example:

```env
JWT_SECRET=replace-with-a-long-random-string
GROQ_API_KEY=your_groq_key_here
```

`DATABASE_URL` and `CHAT_DATABASE_URL` are gone. If `DATABASE_URL` still points at PostgreSQL, the API refuses to start and says how to [move your data](migrations/README.md#moving-from-postgres).

## Category suggestions

Statement imports (SBI, Kotak, Slice) arrive with a blank category. The preview pre-fills it from what you have already saved, and you still review and edit every row before saving. Nothing is stored until you commit; CSV imports are unchanged.

1. **Merchant name:** the bank text (`UPI/DR/4123/SWIGGY/YESB/swiggy@ybl`) is reduced to its merchant words (`SWIGGY`).
2. **History:** your saved transactions are read live. If one category covers at least 60% of past transactions for that merchant, it is filled in. Merchants with no history, or a split history, stay blank.

The review table shows a single note under the row counts when any category was filled this way; editing a category removes it from that count. Committing an import or fixing a category in the ledger improves the next import automatically; there is nothing to run or schedule, and no AI service is involved.

## Database

SQLite, one file: `data/parsel.db` (gitignored). Schema SQL lives in [`migrations/`](migrations/) and is applied automatically at startup: pending `NNN_*.sql` files run in order, each in its own transaction, with a backup of the file taken first. The chat assistant queries through a separate read-only connection that may only `SELECT` from `transactions`.

See [`migrations/README.md`](migrations/README.md) for adding a migration, [backups](migrations/README.md#backups), restores, and [moving from PostgreSQL](migrations/README.md#moving-from-postgres).

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

Tests run against a throwaway SQLite file created per test run (it never touches `data/parsel.db`). Most tests mock the database and the LLM; the real-DB tests ([`test_database.py`](backend/tests/test_database.py), [`test_dashboard_overview.py`](backend/tests/test_dashboard_overview.py), [`test_category_suggest.py`](backend/tests/test_category_suggest.py), [`test_chat_agent_role.py`](backend/tests/test_chat_agent_role.py)) always run. `test_chat_agent_role.py` checks that the chat agent can read `transactions` but cannot write, read `users`, or use `PRAGMA` / `ATTACH`.

## Further reading

- [ARCHITECTURE.md](ARCHITECTURE.md) — backend/frontend layout, runtime flow, and API boundaries