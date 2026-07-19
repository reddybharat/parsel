from fastapi import APIRouter, Depends, HTTPException

from auth.deps import get_current_user
from auth.models import User
from chat.agent.graph import exit_thread, resume_turn, start_turn
from chat.exceptions import UnknownThreadError
from chat.schemas import ChatExitRequest, ChatInvokeRequest, ChatResumeRequest
from common.logger import get_logger

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)


def _handle_chat_error(
    exc: Exception,
    *,
    log_label: str,
    server_detail: str,
) -> None:
    if isinstance(exc, UnknownThreadError):
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    if isinstance(exc, ValueError):
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    logger.exception("%s: %s", log_label, exc)
    raise HTTPException(status_code=500, detail=server_detail) from exc


@router.post("/invoke")
async def chat_invoke(
    body: ChatInvokeRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        reply, thread_id = await start_turn(body.message, user_id=current_user.id)
        return {"reply": reply, "thread_id": thread_id}
    except HTTPException:
        raise
    except Exception as exc:
        _handle_chat_error(
            exc,
            log_label="Chat invoke failed",
            server_detail="Sorry, couldn't process your request due to a technical error. Please try again later.",
        )


@router.post("/resume")
async def chat_resume(
    body: ChatResumeRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        reply = await resume_turn(body.thread_id, body.message, user_id=current_user.id)
        return {"reply": reply, "thread_id": body.thread_id}
    except HTTPException:
        raise
    except Exception as exc:
        _handle_chat_error(
            exc,
            log_label="Chat resume failed",
            server_detail="Sorry, couldn't process your request due to a technical error. Please try again later.",
        )


@router.post("/exit")
async def chat_exit(
    body: ChatExitRequest,
    current_user: User = Depends(get_current_user),
) -> dict:
    try:
        await exit_thread(body.thread_id, user_id=current_user.id)
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as exc:
        _handle_chat_error(
            exc,
            log_label="Chat exit failed",
            server_detail="Sorry, couldn't end the chat session due to a technical error.",
        )
