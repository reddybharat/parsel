## Architecture Overview

This project is organized around two feature packages — **tracker** and **chat** — plus a small **common** package for shared utilities.

- **common/**: shared logging and database connection only (no execute helpers).
- **tracker/**: all transaction CRUD, validations, CSV import/export, FastAPI routes, and Streamlit UI tabs for Add/Search.
- **chat/**: the LangGraph-based finance assistant (agent), its FastAPI APIs, and the Streamlit Chat tab.

Both tracker and chat use the same PostgreSQL database via a single **`DATABASE_URL`** environment variable. There is **no Supabase client** in the runtime path; Supabase is only a convenient way to host Postgres if you choose.

### Runtime components

- **FastAPI (`main.py`)**
  - Mounts `tracker.api.transactions` for all `/transactions` endpoints.
  - Mounts `chat.api.chat` for `/chat/invoke`, `/chat/resume`, and `/chat/exit`.
- **Streamlit (`app.py`)**
  - Uses `common.logger.get_logger` to configure logging on startup.
  - Renders three main tabs:
    - `tracker.ui.tabs.add_txn_tab.render_add_transaction`
    - `tracker.ui.tabs.search_tab.render_search`
    - `chat.ui.chat_tab.render_chat`
### Common package (`common/`)

- `database.py`: shared PostgreSQL connection only — `get_database_url()`, `is_database_configured()`, `open_session_connection()`, `get_connection()`. No execute/query helpers.
- `logger.py`: shared logging configuration.

### Tracker package (`tracker/`)

- `utils/db.py`: tracker execute helpers (execute_query, execute_insert, execute_update_delete, execute_update_returning). Require a connection from `common.database`.
- `schemas.py`: Pydantic models for request/response payloads and internal use.
- `constants.py`: fixed list of allowed categories and any other domain constants.
- `validations.py`: shared validation helpers (amount > 0, category required, date not in future, etc.).
- `services.py`: CSV-related logic (export, template, import) using `tracker.utils.db` and `tracker.schemas`.
- `api/transactions.py`: FastAPI router exposing CRUD endpoints for `/transactions`; uses `common.database.get_connection` and `tracker.utils.db` execute helpers.
- `ui/`:
  - `common.py`: shared Streamlit helpers and common error messaging.
  - `tabs/add_txn_tab.py`, `tabs/search_tab.py`: page-level layout and interactions.
  - `utils/import_csv_section.py`, `utils/search_filters.py`, `utils/search_results.py`: reusable UI pieces for CSV import, filters, and results table.

### Chat package (`chat/`)

- `utils/readonly_sql.py`: read-only SQL executor with guardrails (SELECT only, blocked keywords). Used by agent tools; uses session connection from Streamlit when set via `set_agent_connection()`.
- `agent/`:
  - `graph.py`: constructs the LangGraph graph and exposes `run_agent`.
  - `nodes.py`: defines the core agent node and tool orchestration.
  - `tools.py`: tools for listing tables, inspecting schema, and executing safe SQL.
  - `state.py`: the agent state (e.g., messages list).
  - `prompt.py`: system prompt and instructions for the agent.
  - `llm.py`: Gemini LLM wrapper and configuration.
- `api/chat.py`: FastAPI router for:
  - `POST /chat/invoke` → calls `run_agent` with the provided chat history and returns `{ "reply": "..." }`.
  - `POST /chat/resume` → stub endpoint signalling that resume is not yet implemented.
  - `POST /chat/exit` → stub endpoint for ending a session.
- `ui/chat_tab.py`: Streamlit tab that calls the chat API or agent and displays the conversation.

### High-level flow

```mermaid
flowchart TD
  mainApp["FastAPI main.py"] --> trackerApi["tracker.api.transactions"]
  mainApp --> chatApi["chat.api.chat"]

  streamlitApp["Streamlit app.py"] --> trackerUI["tracker.ui.tabs (Add, Search)"]
  streamlitApp --> chatUI["chat.ui.chat_tab"]

  trackerApi --> commonDB["common.database"]
  trackerApi --> trackerDb["tracker.utils.db (execute_*)"]
  trackerDb --> commonDB
  streamlitApp --> commonDB
  trackerUI --> trackerDb

  chatApi --> chatAgent["chat.agent.graph (run_agent)"]
  chatUI --> chatAgent
  chatAgent --> chatReadonly["chat.utils.readonly_sql"]
  chatReadonly --> commonDB
```

This layout is designed so that:

- The **connection** is in `common.database`; **execute helpers** live in `tracker.utils.db` (tracker) and `chat.utils.readonly_sql` (chat).
- **Feature code** for transactions and chat lives in separate, clearly named packages.
- **UI layers** (FastAPI and Streamlit) depend on feature packages, not the other way around.

