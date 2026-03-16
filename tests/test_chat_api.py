from typing import Any

from fastapi import FastAPI
from fastapi.testclient import TestClient

from chat.router import router as chat_router


def create_app() -> FastAPI:
    app = FastAPI()
    app.include_router(chat_router)
    return app


def test_chat_invoke_happy_path(monkeypatch):
    app = create_app()

    def fake_run_agent(messages: list[dict[str, Any]]) -> str:
        assert messages
        return "ok"

    import chat.api.chat as chat_api

    monkeypatch.setattr(chat_api, "run_agent", fake_run_agent)

    client = TestClient(app)
    resp = client.post(
        "/chat/invoke",
        json={"messages": [{"role": "user", "content": "Hello"}]},
    )
    assert resp.status_code == 200
    assert resp.json() == {"reply": "ok"}


def test_chat_invoke_requires_messages():
    app = create_app()
    client = TestClient(app)

    resp = client.post("/chat/invoke", json={})
    assert resp.status_code == 400


def test_chat_resume_and_exit_stubs():
    app = create_app()
    client = TestClient(app)

    resume = client.post("/chat/resume", json={})
    assert resume.status_code == 200
    assert resume.json()["status"] == "resume_not_implemented"

    exit_resp = client.post("/chat/exit", json={})
    assert exit_resp.status_code == 200
    assert exit_resp.json()["status"] == "ok"

