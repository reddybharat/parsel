from __future__ import annotations

from typing import Any

from common.api_client import post


def chat_invoke(messages: list[dict[str, Any]]) -> dict[str, Any]:
    return post("/chat/invoke", json={"messages": messages})


def chat_resume(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] | None = payload if payload is not None else {}
    return post("/chat/resume", json=body)


def chat_exit(payload: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] | None = payload if payload is not None else {}
    return post("/chat/exit", json=body)


