# Code Enhancements Checklist

Actionable points from the codebase review. Tests are out of scope for now.

---

## High priority

### Security
- [x] **Parameterize `get_schema` table name** — Done: `execute_readonly_query` now accepts optional `params`; `get_schema` uses `WHERE table_name = %s` with `params=(table_name,)`.
- [x] **Validate `transaction_id` as UUID** — Done: path param is now `transaction_id: UUID` in get/update/delete; handlers use `str(transaction_id)` when calling the DB. Invalid IDs get 422 from FastAPI.

### Correctness / API contract
- [x] **Resolve `GET /summary`** — Removed from README; endpoint was never implemented and is no longer required.
- [x] **Sanitize chat API 500 responses** — Done: `chat/api/chat.py` now logs the exception with `logger.exception()` and returns a generic message: "Sorry, couldn't process your request due to a technical error. Please try again later."

---

## Medium priority

### Connection / lifecycle
- [ ] **Unify DB connection for chat path** — In `chat/utils/readonly_sql.py`, when creating a new connection (e.g. for API requests), use the same abstraction as the rest of the app (e.g. `common.database.get_connection()` or the pool when you have one) instead of raw `psycopg2.connect(get_database_url())`.
- [ ] **Streamlit connection refresh** — In `app.py` (and any place that uses `st.session_state.db_conn`), add handling for stale/failed connections: catch connection errors on use and reopen (or clear `db_conn` and show a “reconnect” message) so long-lived sessions don’t break when the server closes idle connections.

### Robustness
- [ ] **Validate chat request body** — In `chat/api/chat.py`, introduce a Pydantic model for the invoke body (e.g. `messages: list[ChatMessage]` with `role` and `content`), validate message structure and optionally cap list length/size so malformed or oversized payloads are rejected early.
- [ ] **Validate message structure in `run_agent`** — In `chat/agent/graph.py`, before building LangChain messages, validate/sanitize each item (required keys, allowed roles, non-None content). Handle missing keys and unexpected roles explicitly to avoid `KeyError` or confusing behavior.
- [ ] **Narrow CSV import exception handling** — In `tracker/services.py` inside the row loop, catch only expected validation/parsing exceptions (e.g. `ValueError`) for row-level errors; let programming errors propagate (or log and re-raise) instead of swallowing them.
- [ ] **Clarify search tab “DB not configured”** — In `tracker/ui/tabs/search_tab.py`, avoid using a bare `except ValueError` to show “Database not configured.” Use a dedicated exception or an explicit check (e.g. for a specific error message or a flag from the DB layer) so other `ValueError`s don’t show that message.

### Dependencies and config
- [ ] **Add explicit `langgraph` to requirements.txt** — Add `langgraph` with a version pin so the dependency is explicit and upgrades don’t break the app if LangChain’s dependencies change.
- [ ] **Centralize `load_dotenv()`** — Call `load_dotenv()` once at application entry (e.g. in `main.py` and `app.py`). Remove `load_dotenv()` from `common/database.py` and `chat/agent/llm.py` so env loading is in one place.

---

## Low priority

### API design
- [ ] **List transactions pagination** — Add optional query parameters to `GET /transactions` (e.g. `limit`, `offset` or `page`) and document them, or clearly document that the endpoint returns a fixed number of items (e.g. last 20).
- [ ] **PATCH empty body** — Decide and document behavior when PATCH body has no updatable fields: either return 400 with a clear message or keep current “return current resource” behavior and document it.

### Observability and config
- [ ] **Configurable log level** — In `common/logger.py`, read log level from environment (e.g. `LOG_LEVEL`) and set the root logger level accordingly so you can turn on DEBUG in development without code changes.
- [ ] **Request/session IDs (optional)** — Add a request ID (e.g. in FastAPI middleware) or session identifier and include it in log lines so you can trace a single request or chat session across the app.

### Data and consistency
- [ ] **Normalize `description` (empty vs None)** — Align API and UI: either treat empty string as `None` in the API (e.g. in create/update) or allow empty string consistently and document it.
- [ ] **Field length limits** — Add `max_length` for `description` (and any other free-text fields) in Pydantic models and/or align with DB column limits to avoid unexpectedly large values.
- [ ] **Schema cache in chat tools** — In `chat/agent/tools.py`, document that `_SCHEMA_CACHE` is process-wide and never cleared, or add a TTL/clear mechanism if you run schema changes without restarting the process.

### Code quality (optional)
- [ ] **Search tab ORDER BY** — In `tracker/ui/tabs/search_tab.py`, the dynamic `ORDER BY` uses a fixed allow-list; consider validating `sort_col` against an explicit set and raising if unknown, for clarity and future-proofing.
- [ ] **Router prefix** — In `tracker/api/transactions.py`, optionally use `prefix="/transactions"` on the router and define routes as `""`, `"/{transaction_id}"`, etc., for consistency with the chat router and easier nesting.

---

## Summary table (no tests)

| Priority | Area              | Count |
|----------|-------------------|-------|
| High     | Security          | 2     |
| High     | Correctness/API   | 2     |
| Medium   | Connection        | 2     |
| Medium   | Robustness        | 4     |
| Medium   | Dependencies/config | 2   |
| Low      | API design        | 2     |
| Low      | Observability     | 2     |
| Low      | Data consistency  | 3     |
| Low      | Code quality      | 2     |

Total: **21 points** (tests excluded).
