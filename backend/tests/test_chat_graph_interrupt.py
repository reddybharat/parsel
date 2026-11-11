"""Graph interrupt/resume tests (mocked inner agent, no Groq)."""

import asyncio
import uuid
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessage

from chat.agent.graph import exit_thread, resume_turn, start_turn, thread_awaiting_user
from chat.agent.replies import TECHNICAL_ERROR_REPLY
from chat.exceptions import UnknownThreadError

USER_ID = uuid.UUID("33333333-3333-3333-3333-333333333333")
OTHER_USER_ID = uuid.UUID("44444444-4444-4444-4444-444444444444")


@pytest.fixture
def mock_inner_agent():
    async def fake_ainvoke(payload):
        last = payload["messages"][-1]
        text = last.content if hasattr(last, "content") else str(last)
        return {
            "messages": payload["messages"]
            + [AIMessage(content=f"answer:{text}")]
        }

    with patch("chat.agent.nodes._get_inner_agent") as mock_get:
        inner = AsyncMock()
        inner.ainvoke = fake_ainvoke
        mock_get.return_value = inner
        yield


def test_start_interrupts_awaiting_user(mock_inner_agent):
    async def run():
        reply, thread_id = await start_turn("hello", user_id=USER_ID)
        assert reply == "answer:hello"
        assert thread_id.startswith(f"{USER_ID}:")
        assert await thread_awaiting_user(thread_id)

    asyncio.run(run())


def test_resume_continue_then_interrupt(mock_inner_agent):
    async def run():
        _, thread_id = await start_turn("q1", user_id=USER_ID)
        reply2 = await resume_turn(thread_id, "q2", user_id=USER_ID)
        assert reply2 == "answer:q2"
        assert await thread_awaiting_user(thread_id)

    asyncio.run(run())


def test_exit_ends_thread(mock_inner_agent):
    async def run():
        _, thread_id = await start_turn("q1", user_id=USER_ID)
        await exit_thread(thread_id, user_id=USER_ID)
        assert not await thread_awaiting_user(thread_id)

        with pytest.raises(UnknownThreadError):
            await resume_turn(thread_id, "q2", user_id=USER_ID)

    asyncio.run(run())


def test_resume_after_exit_raises_unknown_thread(mock_inner_agent):
    async def run():
        _, thread_id = await start_turn("q1", user_id=USER_ID)
        await exit_thread(thread_id, user_id=USER_ID)

        with pytest.raises(UnknownThreadError, match="Unknown thread_id"):
            await resume_turn(thread_id, "q2", user_id=USER_ID)

    asyncio.run(run())


def test_other_user_cannot_resume_thread(mock_inner_agent):
    async def run():
        _, thread_id = await start_turn("q1", user_id=USER_ID)
        with pytest.raises(UnknownThreadError):
            await resume_turn(thread_id, "q2", user_id=OTHER_USER_ID)

    asyncio.run(run())


def test_llm_failure_replies_with_technical_error_and_keeps_thread_usable():
    calls = {"n": 0}

    async def flaky_ainvoke(payload):
        calls["n"] += 1
        if calls["n"] == 2:
            raise RuntimeError("Error code: 429 - rate_limit_exceeded")
        last = payload["messages"][-1]
        return {"messages": payload["messages"] + [AIMessage(content=f"answer:{last.content}")]}

    async def run():
        with patch("chat.agent.nodes._get_inner_agent") as mock_get:
            inner = AsyncMock()
            inner.ainvoke = flaky_ainvoke
            mock_get.return_value = inner

            _, thread_id = await start_turn("q1", user_id=USER_ID)
            assert await resume_turn(thread_id, "q2", user_id=USER_ID) == TECHNICAL_ERROR_REPLY
            assert await resume_turn(thread_id, "q3", user_id=USER_ID) == "answer:q3"

    asyncio.run(run())
