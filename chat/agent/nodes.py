"""Graph nodes for the SQL agent."""

from langchain.agents import create_agent
from langgraph.graph import END
from langgraph.types import Command

from chat.agent.llm import get_llm
from chat.agent.prompt import SYSTEM_PROMPT
from chat.agent.state import AgentState
from chat.agent.tools import ALL_TOOLS
from common.logger import get_logger

logger = get_logger(__name__)

_inner_agent = None


def _get_inner_agent():
    """Lazily build and cache the inner agent (LLM + tools)."""
    global _inner_agent
    if _inner_agent is not None:
        return _inner_agent

    logger.info("Building inner agent (LLM + tools)")
    llm = get_llm()
    logger.info("LLM initialized: %s", type(llm).__name__)
    _inner_agent = create_agent(
        model=llm,
        tools=ALL_TOOLS,
        system_prompt=SYSTEM_PROMPT,
    )
    logger.info("Inner agent created successfully")
    return _inner_agent


def agent_node(state: AgentState) -> Command:
    """Single agent node: invoke the LLM agent with full message history.

    The inner agent handles its own tool-calling loop internally
    (call tool -> observe -> reason -> repeat until done).

    Returns Command(goto=END) with the updated messages.
    """
    logger.info("agent_node called with %d messages", len(state["messages"]))
    inner = _get_inner_agent()

    logger.info("Invoking inner agent...")
    result = inner.invoke({"messages": state["messages"]})
    result_messages = result.get("messages", [])
    logger.info("Inner agent returned %d messages", len(result_messages))

    for i, m in enumerate(result_messages):
        logger.debug("  msg[%d] type=%s content_len=%s tool_calls=%s",
                      i, type(m).__name__,
                      len(m.content) if m.content else 0,
                      getattr(m, "tool_calls", None))

    return Command(
        update={"messages": result_messages},
        goto=END,
    )
