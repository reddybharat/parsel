"""Tests for /chat invoke, resume, and exit endpoints."""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient

from chat.exceptions import UnknownThreadError
from main import app

client = TestClient(app)


@pytest.fixture
def mock_start_turn():
    with patch("chat.router.chat.start_turn", new_callable=AsyncMock) as mock:
        mock.return_value = ("First reply", "thread-abc")
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
    assert data["thread_id"] == "thread-abc"
    mock_start_turn.assert_awaited_once_with("Total spend this month?")


def test_chat_invoke_requires_message():
    response = client.post("/chat/invoke", json={})
    assert response.status_code == 422


def test_chat_invoke_rejects_whitespace_only_message():
    response = client.post("/chat/invoke", json={"message": "   "})
    assert response.status_code == 422


def test_chat_resume_follow_up(mock_resume_turn):
    response = client.post(
        "/chat/resume",
        json={"thread_id": "thread-abc", "message": "By category?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["reply"] == "Follow-up reply"
    assert data["thread_id"] == "thread-abc"
    mock_resume_turn.assert_awaited_once_with("thread-abc", "By category?")


def test_chat_resume_unknown_thread():
    with patch("chat.router.chat.resume_turn", new_callable=AsyncMock) as mock:
        mock.side_effect = UnknownThreadError("missing")
        response = client.post(
            "/chat/resume",
            json={"thread_id": "missing", "message": "Hi"},
        )
    assert response.status_code == 404


def test_chat_exit_ok(mock_exit_thread):
    response = client.post("/chat/exit", json={"thread_id": "thread-abc"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    mock_exit_thread.assert_awaited_once_with("thread-abc")


def test_chat_exit_unknown_thread():
    with patch("chat.router.chat.exit_thread", new_callable=AsyncMock) as mock:
        mock.side_effect = UnknownThreadError("missing")
        response = client.post("/chat/exit", json={"thread_id": "missing"})
    assert response.status_code == 404
