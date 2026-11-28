"""Real-DB checks on the chat agent's execute_query: read-only, transactions only,
and only the current user's rows."""

import json
import uuid
from datetime import date
from unittest.mock import patch

import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage, ToolMessage
from sqlalchemy import delete

from auth.models import User
from chat.agent.graph import _get_graph, start_turn
from chat.agent.tools import AGENT_USER_ID, execute_query
from common.database import AGENT_MAX_ROWS, get_connection
from tracker.models import Transaction

pytestmark = pytest.mark.anyio

# WHERE false: no rows change even if the read-only guard were broken.
_FORBIDDEN_QUERIES = [
    "DELETE FROM transactions WHERE false",
    "UPDATE transactions SET category = category WHERE false",
    "INSERT INTO transactions (id) SELECT id FROM transactions WHERE false",
    "CREATE TABLE x (i int)",
    "SELECT password_hash FROM users",
    "WITH u AS (SELECT password_hash FROM users) SELECT count(*) FROM u",
    "SELECT name FROM sqlite_master",
    "SELECT name FROM temp.sqlite_master",
    "PRAGMA table_info(users)",
    "ATTACH DATABASE ':memory:' AS other",
    "SELECT 1; DELETE FROM transactions WHERE false",
    # Ways around the per-user view straight to the real table.
    "SELECT count(*) FROM main.transactions",
    "SELECT amount FROM (SELECT amount FROM main.transactions)",
    "WITH transactions AS (SELECT amount FROM main.transactions) SELECT amount FROM transactions",
    "WITH transactions AS (SELECT amount FROM main.transactions) SELECT count(*) FROM transactions",
]


async def _add_user(txn_count: int) -> uuid.UUID:
    user_id = uuid.uuid4()
    async with get_connection() as session:
        session.add(User(id=user_id, username=f"agent-{user_id}", email=f"{user_id}@example.com", password_hash="x"))
        await session.flush()
        session.add_all(
            Transaction(user_id=user_id, amount=10 + i, is_debit=True, category="Food", bank="SBI",
                        transaction_date=date(2026, 7, 1 + i % 28), description=f"row {i}")
            for i in range(txn_count)
        )
    return user_id


async def _drop_users(*user_ids: uuid.UUID) -> None:
    async with get_connection() as session:
        for user_id in user_ids:
            await session.execute(delete(Transaction).where(Transaction.user_id == user_id))
            await session.execute(delete(User).where(User.id == user_id))


async def _run(query: str, user_id: uuid.UUID | None) -> dict:
    token = AGENT_USER_ID.set(user_id)
    try:
        return json.loads(await execute_query.ainvoke({"query": query}))
    finally:
        AGENT_USER_ID.reset(token)


async def test_agent_reads_only_its_users_transactions():
    alice, bob = await _add_user(3), await _add_user(5)
    try:
        everything = await _run("SELECT count(*) AS n, SUM(amount) AS total FROM transactions", alice)
        assert everything["rows"] == [{"n": 3, "total": 33.0}]

        bobs = await _run(f"SELECT count(*) AS n FROM transactions WHERE user_id = '{bob}'", alice)
        assert bobs["rows"] == [{"n": 0}]

        users = await _run("SELECT DISTINCT user_id FROM transactions", alice)
        assert users["rows"] == [{"user_id": str(alice)}]

        via_cte = await _run(
            "WITH t AS (SELECT amount FROM transactions) SELECT count(*) AS n FROM t", alice
        )
        assert via_cte["rows"] == [{"n": 3}]

        assert (await _run("SELECT count(*) AS n FROM transactions", bob))["rows"] == [{"n": 5}]

        for query in _FORBIDDEN_QUERIES:
            assert (await _run(query, alice))["status"] == "error", query
    finally:
        await _drop_users(alice, bob)


async def test_agent_refuses_without_a_current_user():
    result = await _run("SELECT count(*) FROM transactions", None)
    assert result["status"] == "error"


async def test_agent_rows_are_capped_and_flagged():
    user_id = await _add_user(AGENT_MAX_ROWS + 1)
    try:
        over = await _run("SELECT amount FROM transactions", user_id)
        assert over["row_count"] == AGENT_MAX_ROWS
        assert over["truncated"] is True
        assert str(AGENT_MAX_ROWS) in over["hint"]

        exact = await _run(f"SELECT amount FROM transactions LIMIT {AGENT_MAX_ROWS}", user_id)
        assert exact["row_count"] == AGENT_MAX_ROWS
        assert "truncated" not in exact
    finally:
        await _drop_users(user_id)


async def test_agent_sees_sqlite_error_text_to_fix_its_query():
    user_id = await _add_user(1)
    try:
        result = await _run(
            "SELECT date_trunc('month', transaction_date) FROM transactions", user_id
        )
        assert result["status"] == "error"
        assert "no such function: date_trunc" in result["error"]
    finally:
        await _drop_users(user_id)


class _ScriptedModel(GenericFakeChatModel):
    """Replays fixed replies; tool binding is a no-op since the replies are scripted."""

    def bind_tools(self, tools, **kwargs):  # noqa: ANN001, ANN003, ANN201
        return self


async def test_full_chat_turn_passes_the_signed_in_user_to_the_query():
    alice, bob = await _add_user(2), await _add_user(4)
    model = _ScriptedModel(
        messages=iter(
            [
                AIMessage(
                    content="",
                    tool_calls=[{"name": "execute_query", "args": {"query": "SELECT count(*) AS n FROM transactions"}, "id": "call-1"}],
                ),
                AIMessage(content="You have 2 transactions."),
            ]
        )
    )
    try:
        with patch("chat.agent.nodes.get_llm", return_value=model):
            reply, thread_id = await start_turn("How many transactions do I have?", user_id=alice)
        assert reply == "You have 2 transactions."

        state = await _get_graph().aget_state({"configurable": {"thread_id": thread_id}})
        (tool_message,) = [m for m in state.values["messages"] if isinstance(m, ToolMessage)]
        assert json.loads(tool_message.content)["rows"] == [{"n": 2}]
        assert AGENT_USER_ID.get() is None
    finally:
        await _drop_users(alice, bob)
