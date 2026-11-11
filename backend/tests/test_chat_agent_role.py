"""Real-DB check that the chat agent's login (CHAT_DATABASE_URL) can only read transactions."""

import json

import pytest
from dotenv import load_dotenv

from chat.agent.tools import execute_query
from common.database import is_chat_database_configured

load_dotenv()

pytestmark = [
    pytest.mark.anyio,
    pytest.mark.skipif(
        not is_chat_database_configured(),
        reason="CHAT_DATABASE_URL not set; needs the local parsel_agent login",
    ),
]

# WHERE false: no rows change even if the read-only guard were broken.
_FORBIDDEN_QUERIES = [
    "DELETE FROM transactions WHERE false",
    "UPDATE transactions SET category = category WHERE false",
    "CREATE TABLE x (i int)",
    "SELECT password_hash FROM users",
]


async def test_agent_role_reads_transactions_only() -> None:
    # One test so the cached engine's pool stays on a single event loop.
    ok = json.loads(await execute_query.ainvoke({"query": "SELECT count(*) FROM transactions"}))
    assert ok["status"] == "ok"

    for query in _FORBIDDEN_QUERIES:
        result = json.loads(await execute_query.ainvoke({"query": query}))
        assert result["status"] == "error", query
