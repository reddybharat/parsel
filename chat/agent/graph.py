"""
Edgeless LangGraph StateGraph for the SQL agent.

agent -> wait_user (interrupt) -> Command continue -> agent, or Command exit -> END.
One graph run per session; follow-ups resume via Command(resume=...).
"""

import uuid

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph
from langgraph.types import Command

from chat.agent.checkpointer import get_checkpointer
from chat.agent.nodes import agent_node, wait_user_node
from chat.agent.state import AgentState
from common.logger import get_logger

logger = get_logger(__name__)


def build_graph():
    """Build and compile the edgeless agent graph with checkpointer."""
    logger.info("Building agent graph")
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.add_node("wait_user", wait_user_node)
    graph.set_entry_point("agent")
    compiled = graph.compile(checkpointer=get_checkpointer())
    logger.info("Agent graph compiled successfully")
    return compiled


_compiled_graph = None


def _get_graph():
    """Return a cached compiled graph."""
    global _compiled_graph
    if _compiled_graph is not None:
        return _compiled_graph
    _compiled_graph = build_graph()
    return _compiled_graph


def _thread_config(thread_id: str) -> dict:
    return {"configurable": {"thread_id": thread_id}}


def _extract_reply(result: dict) -> str:
    interrupts = result.get("__interrupt__") or []
    if interrupts:
        value = interrupts[0].value
        if isinstance(value, dict) and value.get("reply"):
            return str(value["reply"])

    ai_messages = [
        m
        for m in result.get("messages", [])
        if isinstance(m, AIMessage)
        and m.content
        and not getattr(m, "tool_calls", None)
    ]
    logger.info("Found %d final AI messages", len(ai_messages))
    if ai_messages:
        return ai_messages[-1].text
    return "I wasn't able to process that request. Could you try rephrasing your question?"


async def thread_awaiting_user(thread_id: str) -> bool:
    """True when the graph is paused at wait_user after an interrupt."""
    graph = _get_graph()
    snapshot = await graph.aget_state(_thread_config(thread_id))
    return bool(snapshot.next)


async def thread_exists(thread_id: str) -> bool:
    """Return True if the checkpointer has any state for this thread."""
    checkpointer = get_checkpointer()
    tup = await checkpointer.aget_tuple(_thread_config(thread_id))
    return tup is not None


async def start_turn(message: str) -> tuple[str, str]:
    """Start a new chat thread: run agent, interrupt at wait_user.

    Returns (reply, thread_id).
    """
    thread_id = str(uuid.uuid4())
    graph = _get_graph()
    logger.info("Starting thread_id=%s", thread_id)
    result = await graph.ainvoke(
        {"messages": [HumanMessage(content=message)]},
        config=_thread_config(thread_id),
    )
    return _extract_reply(result), thread_id


async def resume_turn(thread_id: str, message: str) -> str:
    """Continue after interrupt: Command(resume=continue) -> agent -> wait_user."""
    if not await thread_awaiting_user(thread_id):
        raise ValueError(f"Unknown thread_id: {thread_id}")

    graph = _get_graph()
    logger.info("Resuming thread_id=%s with continue", thread_id)
    result = await graph.ainvoke(
        Command(resume={"action": "continue", "message": message}),
        config=_thread_config(thread_id),
    )
    return _extract_reply(result)


async def exit_thread(thread_id: str) -> None:
    """End session: Command(resume=exit) -> END, then delete checkpoint."""
    if await thread_awaiting_user(thread_id):
        graph = _get_graph()
        logger.info("Exiting thread_id=%s via Command(resume=exit)", thread_id)
        await graph.ainvoke(
            Command(resume={"action": "exit"}),
            config=_thread_config(thread_id),
        )
    elif not await thread_exists(thread_id):
        raise ValueError(f"Unknown thread_id: {thread_id}")

    get_checkpointer().delete_thread(thread_id)
    logger.info("Deleted thread_id=%s", thread_id)
