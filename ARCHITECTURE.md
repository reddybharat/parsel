## Architecture Overview

This project is organized around two feature packages — **tracker** and **chat** — plus a small **common** package for shared utilities.

- **common/**: shared logging and database connection only (no execute helpers).
- **tracker/**: all transaction CRUD, validations, CSV import/export, FastAPI routes, and Streamlit UI tabs for Add/Search.
- **chat/**: the LangGraph-based finance assistant (agent), its FastAPI APIs, and the Streamlit Chat tab.

Both tracker and chat use the same PostgreSQL database via a single **`DATABASE_URL`** environment variable. There is **no Supabase client** in the runtime path; Supabase is only a convenient way to host Postgres if you choose.

### Runtime components

- **FastAPI (`main.py`)**
  - Includes `tracker.router.transactions` for `/transactions` endpoints.
  - Includes `tracker.router.dashboard` for `/dashboard` endpoints.
  - Includes `chat.router.chat` for `/chat/invoke`, `/chat/resume`, and `/chat/exit`.
- **Streamlit (`app.py`)**
  - Uses `common.logger.get_logger` to configure logging on startup.
  - Renders three main tabs:
    - `Overview` tab: `tracker.ui.tabs.dashboard_tab.render_dashboard_overview`
    - `Transactions` tab: `tracker.ui.tabs.search_tab.render_search` and `tracker.ui.tabs.add_txn_tab.render_add_transaction`
    - `Chat` tab: `chat.ui.chat_tab.render_chat`
  - Communicates with FastAPI exclusively over HTTP via the client layer (`tracker.client`, `chat.client`, and `common.api_client`).
### Common package (`common/`)

- `database.py`: shared PostgreSQL connection only — `get_database_url()`, `is_database_configured()`, `open_session_connection()`, `get_connection()`. No execute/query helpers.
- `logger.py`: shared logging configuration.
- `api_client.py`: shared HTTP client used by Streamlit tabs (`tracker.client`, `chat.client`) to talk to the FastAPI app. Configured via `API_BASE_URL` (default `http://localhost:8000`), raising `ApiClientError` on non-2xx responses.

### Tracker package (`tracker/`)

- `utils/db.py`: tracker execute helpers (execute_query, execute_insert, execute_update_delete, execute_update_returning). Require a connection from `common.database`.
- `schemas.py`: Pydantic models for request/response payloads and internal use.
- `constants.py`: fixed list of allowed categories and any other domain constants.
- `validations.py`: shared validation helpers (amount > 0, category required, date not in future, etc.).
- `services.py`: CSV-related logic (export, template, import) using `tracker.utils.db` and `tracker.schemas`.
- `router/transactions.py`: FastAPI router exposing CRUD endpoints for `/transactions` (search, export, import, create, update, delete); uses `common.database.get_connection` and `tracker.utils.db` execute helpers.
- `router/dashboard.py`: FastAPI router exposing dashboard endpoints under `/dashboard`.
- `client.py`: HTTP client wrapper around the `/transactions` API (`search_transactions`, `create_transaction`, `export_transactions_csv`, `import_transactions_csv`, `update_transaction`, `delete_transaction`); used by the Streamlit Add and Search tabs.
- `ui/`:
  - `common.py`: shared Streamlit helpers and common error messaging.
  - `tabs/dashboard_tab.py`: overview page with summary cards, monthly insights, and 6-month spending trend chart.
  - `tabs/add_txn_tab.py`, `tabs/search_tab.py`: page-level layout and interactions.
  - `utils/import_csv_section.py`, `utils/search_filters.py`, `utils/search_results.py`: reusable UI pieces for CSV import, filters, and results table.

#### Dashboard chart notes

- The spending trend chart in `tracker.ui.tabs.dashboard_tab` uses Altair with Streamlit `width="stretch"` rendering.
- The y-axis is explicitly controlled with a domain of `[0, max_spend + 30000]` to provide fixed headroom over current data.
- Bar values are sanitized to finite numeric values before charting to avoid rendering failures from invalid inputs.

### Chat package (`chat/`)

- `agent/`:
  - `graph.py`: constructs the LangGraph graph and exposes `run_agent`.
  - `nodes.py`: defines the core agent node and tool orchestration.
  - `tools.py`: `list_tables`, `get_table_schema`, `query_checker`, `execute_query`, `get_current_date`; `execute_query` uses `common.database.get_connection()`.
  - `db_config.py`: table names and schema text for the agent.
  - `schema.py`: Pydantic `args_schema` models for tools.
  - `state.py`: the agent state (e.g., messages list).
  - `prompt.py`: system prompt and instructions for the agent.
  - `llm.py`: Gemini LLM wrapper and configuration.
- `router/chat.py`: FastAPI router for:
  - `POST /chat/invoke` → calls `run_agent` with the provided chat history and returns `{ "reply": "..." }`.
  - `POST /chat/resume` → stub endpoint signalling that resume is not yet implemented.
  - `POST /chat/exit` → stub endpoint for ending a session.
- `client.py`: HTTP client wrapper for the chat API (`chat_invoke`, `chat_resume`, `chat_exit`); used by the Streamlit Chat tab.
- `ui/chat_tab.py`: Streamlit tab that calls the chat API via `chat.client` and displays the conversation.

### High-level flow

```mermaid
flowchart TD
  streamlitApp["Streamlit app.py"] --> trackerUI["Transactions tab (Search, Add)"]
  streamlitApp --> chatUI["chat.ui.chat_tab"]
  trackerUI --> trackerClient["tracker.client"]
  chatUI --> chatClient["chat.client"]
  trackerClient --> apiClient["common.api_client (HTTP)"]
  chatClient --> apiClient
  apiClient --> mainApp["FastAPI main.py"]
  mainApp --> trackerRouter["tracker.router.transactions"]
  mainApp --> dashboardRouter["tracker.router.dashboard"]
  mainApp --> chatRouter["chat.router.chat"]
  trackerRouter --> commonDB["common.database"]
  trackerRouter --> trackerDb["tracker.utils.db"]
  trackerDb --> commonDB
  chatRouter --> chatAgent["chat.agent.graph (run_agent)"]
  chatAgent --> commonDB
```

This layout is designed so that:

- The **connection** is in `common.database`; **execute helpers** live in `tracker.utils.db` (tracker); the chat agent runs SQL from `chat.agent.tools.execute_query` via the same pool.
- **Feature code** for transactions and chat lives in separate, clearly named packages.
- **UI layers** (FastAPI and Streamlit) depend on feature packages via HTTP APIs and shared clients, not the other way around.

