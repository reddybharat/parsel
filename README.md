# Parsel

Parsel is an INR-focused personal finance tracker with a FastAPI backend and a React frontend.

## Project layout

```text
personal_finance_tracker/
├── backend/                 # FastAPI app + business logic + tests
│   ├── main.py
│   ├── requirements.txt
│   ├── common/
│   ├── tracker/
│   ├── chat/
│   └── tests/
├── frontend/                # React + Vite + Tailwind UI
│   ├── package.json
│   └── src/
├── docs/design/             # Stitch integration files and route mapping
└── ARCHITECTURE.md
```

## Quick start

### 1) Backend

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn main:app --reload
```

- API: [http://127.0.0.1:8000](http://127.0.0.1:8000)
- OpenAPI docs: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

- UI: [http://127.0.0.1:5173](http://127.0.0.1:5173)

## Environment variables

Configure in backend runtime environment:

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `GROQ_API_KEY` | For chat | LLM key for chat agent |
| `GROQ_MODEL` | No | Override default Groq model |
| `CORS_ORIGINS` | No | Allowed frontend origins; default includes localhost:5173 |
| `LOG_LEVEL` | No | Logging verbosity |

Optional for Stitch MCP:

| Variable | Required | Purpose |
|---|---|---|
| `STITCH_API_KEY` | For Stitch sync | API key used in `.cursor/mcp.json` |

## API reference

| Area | Method | Path |
|---|---|---|
| Root | GET | `/` |
| Tracker config | GET | `/config/tracker` |
| Transactions | GET | `/transactions/search` |
| Transactions | POST | `/transactions` |
| Transactions | PATCH | `/transactions/{id}` |
| Transactions | DELETE | `/transactions/{id}` |
| Transactions | GET | `/transactions/export` |
| Transactions | GET | `/transactions/import-template` |
| Transactions | POST | `/transactions/import` |
| Dashboard | GET | `/dashboard/overview` |
| Chat | POST | `/chat/invoke` |
| Chat | POST | `/chat/resume` |
| Chat | POST | `/chat/exit` |

## Testing

Run backend tests:

```powershell
cd backend
python -m pytest tests/test_chat_api.py tests/test_chat_graph_interrupt.py -v
```

## Design intake

- Stitch MCP config: `.cursor/mcp.json`
- Stitch input docs: `docs/design/stitch.md`
- Stitch payload placeholders:
  - `docs/design/stitch-project.json`
  - `docs/design/stitch-screens.json`
- Route mapping: `docs/design/stitch-route-map.md`
