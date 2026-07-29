## Architecture Overview

Parsel uses a clear split:

- `backend/` for FastAPI APIs, domain logic, and database access.
- `frontend/` for the React UI.

The API is stateless and directly calls feature services.

## Backend structure

- `backend/main.py`: FastAPI app setup, CORS, router registration, JWT auth wiring.
- `backend/common/`: shared database, declarative base, and logging utilities.
- `backend/auth/`: user model, register/login, JWT helpers, `get_current_user` dependency.
- `backend/tracker/`: transactions, dashboard services, constants, schemas, routers (scoped by `user_id`).
- `backend/chat/`: chat agent graph and chat API routes (thread + SQL scoped to user).
- `backend/tests/`: backend tests.

## Frontend structure

- `frontend/src/App.tsx`: auth routes, protected shell, and navigation.
- `frontend/src/lib/auth.tsx`: AuthProvider and token session helpers.
- `frontend/src/pages/AuthPage.tsx`: login and register.
- `frontend/src/pages/OverviewPage.tsx`: dashboard view.
- `frontend/src/pages/SearchPage.tsx`: searchable transaction ledger with edit/delete/export.
- `frontend/src/pages/AddPage.tsx`: transaction create form and CSV import.
- `frontend/src/pages/ChatPage.tsx`: chat UI with invoke/resume/exit flow.
- `frontend/src/api/`: fetch wrappers for API calls (Bearer token attached in `client.ts`).

## Runtime flow

```mermaid
flowchart LR
  FE[React frontend] --> API[FastAPI backend]
  API --> Auth[auth register and login]
  API --> Tracker[tracker routers and services]
  API --> Chat[chat router and agent]
  Auth --> DB[(PostgreSQL)]
  Tracker --> DB
  Chat --> DB
```

## API boundaries

- Auth (public)
  - `/auth/register`
  - `/auth/login`
- Tracker (Bearer JWT required; data scoped to current user)
  - `/config/tracker`
  - `/transactions/*`
  - `/dashboard/overview`
- Chat (Bearer JWT required; threads and SQL scoped to current user)
  - `/chat/invoke`
  - `/chat/resume`
  - `/chat/exit`

## Stitch integration notes

- MCP config is stored in `.cursor/mcp.json`.
- Design payload files are expected in `docs/design/`.
- Frontend uses fallback route mapping in `docs/design/stitch-route-map.md` until full Stitch payloads are retrieved.
