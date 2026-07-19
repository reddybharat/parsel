"""Tests for /chat invoke, resume, and exit endpoints."""

from unittest.mock import AsyncMock, patch
import uuid

import pytest
from fastapi.testclient import TestClient

import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from auth.deps import get_current_user
from auth.models import User
from auth.security import hash_password
from chat.exceptions import UnknownThreadError
from main import app

client = TestClient(app)

USER_ID = uuid.UUID("22222222-2222-2222-2222-222222222222")
THREAD_ID = f"{USER_ID}:thread-abc"


def _user() -> User:
    return User(
        id=USER_ID,
        username="chatter",
        email="chat@example.com",
        password_hash=hash_password("password123"),
    )


@pytest.fixture(autouse=True)
def auth_override():
    async def override():
        return _user()

    app.dependency_overrides[get_current_user] = override
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def mock_start_turn():
    with patch("chat.router.chat.start_turn", new_callable=AsyncMock) as mock:
        mock.return_value = ("First reply", THREAD_ID)
        yield mock


@pytest.fixture
def mock_resume_turn():
    with patch("chat.router.chat.resume_turn", new_callable=AsyncMock) as mock:
        mock.return_value = "Follow-up reply"
        yield mock


@pytest.fixture
def mock_exit_thread():
    with patch("chat.router.chat.exit_thread", new_callable=AsyncMock) as mock:
        mock.return_value = None
        yield mock


def test_chat_invoke_returns_thread_id(mock_start_turn):
    response = client.post(
        "/chat/invoke",
        json={"message": "Total spend this month?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "First reply"
    assert data["thread_id"] == THREAD_ID
    mock_start_turn.assert_awaited_once_with("Total spend this month?", user_id=USER_ID)


def test_chat_invoke_requires_message():
    response = client.post("/chat/invoke", json={})
    assert response.status_code == 422


def test_chat_invoke_rejects_whitespace_only_message():
    response = client.post("/chat/invoke", json={"message": "   "})
    assert response.status_code == 422


def test_chat_resume_follow_up(mock_resume_turn):
    response = client.post(
        "/chat/resume",
        json={"thread_id": THREAD_ID, "message": "By category?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Follow-up reply"
    assert data["thread_id"] == THREAD_ID
    mock_resume_turn.assert_awaited_once_with(THREAD_ID, "By category?", user_id=USER_ID)


def test_chat_resume_unknown_thread():
    with patch("chat.router.chat.resume_turn", new_callable=AsyncMock) as mock:
        mock.side_effect = UnknownThreadError("missing")
        response = client.post(
            "/chat/resume",
            json={"thread_id": "missing", "message": "Hi"},
        )
    assert response.status_code == 404


def test_chat_exit_ok(mock_exit_thread):
    response = client.post("/chat/exit", json={"thread_id": THREAD_ID})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mock_exit_thread.assert_awaited_once_with(THREAD_ID, user_id=USER_ID)


def test_chat_exit_unknown_thread():
    with patch("chat.router.chat.exit_thread", new_callable=AsyncMock) as mock:
        mock.side_effect = UnknownThreadError("missing")
        response = client.post("/chat/exit", json={"thread_id": "missing"})
    assert response.status_code == 404


def test_chat_requires_auth_without_override():
    app.dependency_overrides.clear()
    response = client.post("/chat/invoke", json={"message": "hi"})
    assert response.status_code == 401
