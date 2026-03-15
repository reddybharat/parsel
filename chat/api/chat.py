"""
Chat API: invoke, resume, exit endpoints.
Invoke runs the agent graph; resume and exit are stubs for future use.
"""

from typing import Any

from fastapi import APIRouter, HTTPException

from chat.agent.graph import run_agent
from common.logger import get_logger

router = APIRouter(tags=["chat"])
logger = get_logger(__name__)


@router.post("/invoke")
def chat_invoke(body: dict[str, Any]) -> dict:
    """
    Run the chat agent with the given message history.
    Body: { "messages": [ {"role": "user"|"assistant", "content": "..." } ] }
    Returns: { "reply": "<assistant text>" }
    """
    messages = body.get("messages") if isinstance(body, dict) else None
    if not messages or not isinstance(messages, list):
        raise HTTPException(status_code=400, detail="Request body must include 'messages' (list of {role, content}).")
    try:
        reply = run_agent(messages)
        return {"reply": reply}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Chat invoke failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Sorry, couldn't process your request due to a technical error. Please try again later.",
        )


@router.post("/resume")
def chat_resume(body: dict | None = None) -> dict:
    """
    Resume a paused conversation (e.g. human-in-the-loop).
    Stub: returns status indicating not implemented.
    """
    return {"status": "resume_not_implemented"}


@router.post("/exit")
def chat_exit(body: dict | None = None) -> dict:
    """
    End or stop a conversation/session.
    Stub: returns ok.
    """
    return {"status": "ok"}
