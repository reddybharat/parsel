from __future__ import annotations

from typing import Any

from common.api_client import post


def chat_invoke(message: str) -> dict[str, Any]:
    return post("/chat/invoke", json={"message": message})


def chat_resume(thread_id: str, message: str) -> dict[str, Any]:
    return post(
        "/chat/resume",
        json={"thread_id": thread_id, "message": message},
    )


def chat_exit(thread_id: str) -> dict[str, Any]:
    return post("/chat/exit", json={"thread_id": thread_id})
