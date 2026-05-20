from fastapi import APIRouter, HTTPException

from chat.agent.graph import exit_thread, resume_turn, start_turn
from chat.schemas import ChatExitRequest, ChatInvokeRequest, ChatResumeRequest
from common.logger import get_logger

router = APIRouter(prefix="/chat", tags=["chat"])
logger = get_logger(__name__)


@router.post("/invoke")
async def chat_invoke(body: ChatInvokeRequest) -> dict:
    try:
        reply, thread_id = await start_turn(body.message.strip())
        return {"reply": reply, "thread_id": thread_id}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.exception("Chat invoke failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Sorry, couldn't process your request due to a technical error. Please try again later.",
        )


@router.post("/resume")
async def chat_resume(body: ChatResumeRequest) -> dict:
    try:
        reply = await resume_turn(
            body.thread_id.strip(),
            body.message.strip(),
        )
        return {"reply": reply, "thread_id": body.thread_id.strip()}
    except ValueError as e:
        detail = str(e)
        status = 404 if detail.startswith("Unknown thread_id") else 400
        raise HTTPException(status_code=status, detail=detail)
    except Exception as e:
        logger.exception("Chat resume failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Sorry, couldn't process your request due to a technical error. Please try again later.",
        )


@router.post("/exit")
async def chat_exit(body: ChatExitRequest) -> dict:
    try:
        await exit_thread(body.thread_id.strip())
        return {"status": "ok"}
    except ValueError as e:
        detail = str(e)
        status = 404 if detail.startswith("Unknown thread_id") else 400
        raise HTTPException(status_code=status, detail=detail)
    except Exception as e:
        logger.exception("Chat exit failed: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Sorry, couldn't end the chat session due to a technical error.",
        )
