"""
Edgeless LangGraph StateGraph for the SQL agent.

Single node (agent_node) that routes to END via Command(goto=END).
Each user query enters the graph at agent_node; message history
is carried in AgentState.
"""

from langchain_core.messages import AIMessage, HumanMessage
from langgraph.graph import StateGraph

from chat.agent.nodes import agent_node
from chat.agent.state import AgentState
from common.logger import get_logger

logger = get_logger(__name__)


def build_graph() -> StateGraph:
    """Build and compile the edgeless agent graph."""
    logger.info("Building agent graph")
    graph = StateGraph(AgentState)
    graph.add_node("agent", agent_node)
    graph.set_entry_point("agent")
    compiled = graph.compile()
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


def run_agent(chat_history: list[dict]) -> str:
    """Run the agent graph with the given chat history.

    Args:
        chat_history: List of {"role": "user"|"assistant", "content": "..."} dicts.

    Returns:
        The assistant's text response.
    """
    graph = _get_graph()

    messages = []
    for msg in chat_history:
        if msg["role"] == "user":
            messages.append(HumanMessage(content=msg["content"]))
        elif msg["role"] == "assistant":
            messages.append(AIMessage(content=msg["content"]))

    logger.info("Invoking graph with %d messages", len(messages))
    result = graph.invoke({"messages": messages})
    logger.info("Graph returned %d messages", len(result.get("messages", [])))

    ai_messages = [
        m for m in result["messages"]
        if isinstance(m, AIMessage) and m.content and not getattr(m, "tool_calls", None)
    ]

    logger.info("Found %d final AI messages", len(ai_messages))
    if ai_messages:
        return ai_messages[-1].text

    return "I wasn't able to process that request. Could you try rephrasing your question?"
