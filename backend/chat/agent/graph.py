"""
Edgeless LangGraph StateGraph for the SQL agent.

agent -> wait_user (interrupt) -> Command continue -> agent, or Command exit -> END.
One graph run per session; follow-ups resume via Command(resume=...).
"""

import uuid

from langchain_core.messages import HumanMessage
from langgraph.graph import StateGraph
from langgraph.types import Command

from chat.agent.checkpointer import get_checkpointer
from chat.agent.nodes import agent_node, wait_user_node
from chat.agent.replies import reply_from_invoke_result
from chat.agent.state import AgentState
from chat.exceptions import UnknownThreadError
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


def _owned_thread_id(user_id: uuid.UUID, thread_id: str) -> str:
    """Reject thread ids that are not prefixed with this user."""
    prefix = f"{user_id}:"
    if not thread_id.startswith(prefix) or not thread_id[len(prefix) :].strip():
        raise UnknownThreadError(thread_id)
    return thread_id


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


async def start_turn(message: str, *, user_id: uuid.UUID) -> tuple[str, str]:
    """Start a new chat thread: run agent, interrupt at wait_user.

    Returns (reply, thread_id). user_id is stored in graph state and used to
    format SYSTEM_PROMPT_TEMPLATE in the agent node.
    """
    thread_id = f"{user_id}:{uuid.uuid4()}"
    graph = _get_graph()
    logger.info("Starting thread_id=%s user_id=%s", thread_id, user_id)
    result = await graph.ainvoke(
        {
            "messages": [HumanMessage(content=message)],
            "user_id": str(user_id),
        },
        config=_thread_config(thread_id),
    )
    return reply_from_invoke_result(result), thread_id


async def resume_turn(thread_id: str, message: str, *, user_id: uuid.UUID) -> str:
    """Continue after interrupt: Command(resume=continue) -> agent -> wait_user."""
    internal_id = _owned_thread_id(user_id, thread_id)
    if not await thread_awaiting_user(internal_id):
        raise UnknownThreadError(thread_id)

    graph = _get_graph()
    logger.info("Resuming thread_id=%s with continue", internal_id)
    result = await graph.ainvoke(
        Command(resume={"action": "continue", "message": message}),
        config=_thread_config(internal_id),
    )
    return reply_from_invoke_result(result)


async def exit_thread(thread_id: str, *, user_id: uuid.UUID) -> None:
    """End session: Command(resume=exit) -> END, then delete checkpoint."""
    internal_id = _owned_thread_id(user_id, thread_id)
    if await thread_awaiting_user(internal_id):
        graph = _get_graph()
        logger.info("Exiting thread_id=%s via Command(resume=exit)", internal_id)
        await graph.ainvoke(
            Command(resume={"action": "exit"}),
            config=_thread_config(internal_id),
        )
    elif not await thread_exists(internal_id):
        raise UnknownThreadError(thread_id)

    get_checkpointer().delete_thread(internal_id)
    logger.info("Deleted thread_id=%s", internal_id)
