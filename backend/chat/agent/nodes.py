"""Graph nodes for the SQL agent."""

from langchain.agents import create_agent
from langchain_core.messages import HumanMessage
from langgraph.graph import END
from langgraph.types import Command, interrupt

from chat.agent.llm import get_llm
from chat.agent.prompt import SYSTEM_PROMPT_TEMPLATE
from chat.agent.replies import final_user_reply
from chat.agent.state import AgentState
from chat.agent.tools import ALL_TOOLS
from common.logger import get_logger

logger = get_logger(__name__)


def _get_inner_agent(user_id: str):
    """Build the inner agent with a system prompt scoped to this user."""
    logger.info("Building inner agent (LLM + tools) for user_id=%s", user_id)
    llm = get_llm()
    logger.info("LLM initialized: %s", type(llm).__name__)
    agent = create_agent(
        model=llm,
        tools=ALL_TOOLS,
        system_prompt=SYSTEM_PROMPT_TEMPLATE.format(user_id=user_id),
    )
    logger.info("Inner agent created successfully")
    return agent


async def agent_node(state: AgentState) -> Command:
    """Run the inner LLM agent, then route to wait_user for continue/exit."""
    user_id = state["user_id"]
    logger.info("agent_node called with %d messages user_id=%s", len(state["messages"]), user_id)
    inner = _get_inner_agent(user_id)

    logger.info("Invoking inner agent...")
    result = await inner.ainvoke({"messages": state["messages"]})
    result_messages = result.get("messages", [])
    logger.info("Inner agent returned %d messages", len(result_messages))

    for i, m in enumerate(result_messages):
        logger.debug(
            "  msg[%d] type=%s content_len=%s tool_calls=%s",
            i,
            type(m).__name__,
            len(m.content) if m.content else 0,
            getattr(m, "tool_calls", None),
        )

    return Command(
        update={"messages": result_messages},
        goto="wait_user",
    )


async def wait_user_node(state: AgentState) -> Command:
    """Pause after each assistant reply until the user continues or exits."""
    reply = final_user_reply(state["messages"])
    logger.info("wait_user_node interrupt (reply_len=%d)", len(reply))

    decision = interrupt({"reply": reply, "status": "awaiting_user"})
    action = decision.get("action") if isinstance(decision, dict) else None
    logger.info("wait_user_node resumed with action=%s", action)

    if action == "exit":
        return Command(goto=END)

    message = (decision.get("message") or "").strip() if isinstance(decision, dict) else ""
    if not message:
        raise ValueError("Resume payload must include a non-empty 'message' when action is 'continue'.")

    return Command(
        update={"messages": [HumanMessage(content=message)]},
        goto="agent",
    )
