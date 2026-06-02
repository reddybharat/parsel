"""User-facing reply extraction for the chat agent graph."""

from langchain_core.messages import AIMessage


def final_user_reply(messages: list) -> str:
    """Last non-tool-call AI message text for the user-facing reply."""
    ai_messages = [
        m
        for m in messages
        if isinstance(m, AIMessage)
        and m.content
        and not getattr(m, "tool_calls", None)
    ]
    if ai_messages:
        return ai_messages[-1].text
    return "I wasn't able to process that request. Could you try rephrasing your question?"


def reply_from_invoke_result(result: dict) -> str:
    """Read the reply from a graph ainvoke result that paused at wait_user."""
    interrupts = result.get("__interrupt__") or []
    if not interrupts:
        raise ValueError("Graph did not interrupt with a reply")

    value = interrupts[0].value
    if isinstance(value, dict) and value.get("reply"):
        return str(value["reply"])

    raise ValueError("Graph did not interrupt with a reply")
