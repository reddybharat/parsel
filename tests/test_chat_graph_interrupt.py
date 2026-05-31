"""Graph interrupt/resume tests (mocked inner agent, no Groq)."""

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessage

from chat.agent.graph import exit_thread, resume_turn, start_turn, thread_awaiting_user


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
        reply, thread_id = await start_turn("hello")
        assert reply == "answer:hello"
        assert await thread_awaiting_user(thread_id)

    asyncio.run(run())


def test_resume_continue_then_interrupt(mock_inner_agent):
    async def run():
        _, thread_id = await start_turn("q1")
        reply2 = await resume_turn(thread_id, "q2")
        assert reply2 == "answer:q2"
        assert await thread_awaiting_user(thread_id)

    asyncio.run(run())


def test_exit_ends_thread(mock_inner_agent):
    async def run():
        _, thread_id = await start_turn("q1")
        await exit_thread(thread_id)
        assert not await thread_awaiting_user(thread_id)

        with pytest.raises(ValueError, match="Unknown thread_id"):
            await resume_turn(thread_id, "q2")

    asyncio.run(run())
