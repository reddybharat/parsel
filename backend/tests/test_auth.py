"""Auth register/login and protected-route tests (DB mocked)."""

from unittest.mock import AsyncMock, MagicMock, patch
import uuid

import pytest
from fastapi.testclient import TestClient

import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from auth.deps import get_current_user
from auth.models import User
from auth.security import create_access_token, hash_password, verify_password
from auth.service import (
    AccountInactiveError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    UsernameAlreadyTakenError,
)
from main import app

client = TestClient(app)

ALICE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")
STRONG_PASSWORD = "Password1!"


def _register_payload(**overrides):
    payload = {
        "username": "alice",
        "email": "alice@example.com",
        "password": STRONG_PASSWORD,
        "confirm_password": STRONG_PASSWORD,
    }
    payload.update(overrides)
    return payload


def _user(
    user_id: uuid.UUID = ALICE_ID,
    username: str = "alice",
    email: str = "alice@example.com",
) -> User:
    return User(
        id=user_id,
        username=username,
        email=email,
        password_hash=hash_password(STRONG_PASSWORD),
    )


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.clear()


def test_hash_and_verify_password():
    hashed = hash_password("secret-pass")
    assert verify_password("secret-pass", hashed)
    assert not verify_password("wrong", hashed)


def test_register_returns_token():
    user = _user()
    with patch("auth.router.register_user", new_callable=AsyncMock, return_value=user):
        response = client.post("/auth/register", json=_register_payload())
    assert response.status_code == 201
    data = response.json()
    assert data["token_type"] == "bearer"
    assert isinstance(data["access_token"], str) and data["access_token"]


def test_register_duplicate_username_conflict():
    with patch(
        "auth.router.register_user",
        new_callable=AsyncMock,
        side_effect=UsernameAlreadyTakenError("Username is already taken."),
    ):
        response = client.post("/auth/register", json=_register_payload())
    assert response.status_code == 409


def test_register_duplicate_email_conflict():
    with patch(
        "auth.router.register_user",
        new_callable=AsyncMock,
        side_effect=EmailAlreadyRegisteredError("Email is already registered."),
    ):
        response = client.post(
            "/auth/register",
            json=_register_payload(username="alice2"),
        )
    assert response.status_code == 409


def test_register_rejects_invalid_email():
    response = client.post(
        "/auth/register",
        json=_register_payload(email="not-an-email"),
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any("valid email" in str(item.get("msg", "")).lower() for item in detail)


def test_register_rejects_invalid_username():
    response = client.post(
        "/auth/register",
        json=_register_payload(username="bad name!"),
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any("letters, numbers, and underscores" in str(item.get("msg", "")) for item in detail)


def test_register_rejects_short_password():
    response = client.post(
        "/auth/register",
        json=_register_payload(password="Short1!", confirm_password="Short1!"),
    )
    assert response.status_code == 422


def test_register_rejects_weak_password():
    response = client.post(
        "/auth/register",
        json=_register_payload(password="password123", confirm_password="password123"),
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    msgs = " ".join(str(item.get("msg", "")).lower() for item in detail)
    assert "uppercase" in msgs or "symbol" in msgs


def test_register_rejects_password_mismatch():
    response = client.post(
        "/auth/register",
        json=_register_payload(confirm_password="Password2!"),
    )
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert any("do not match" in str(item.get("msg", "")).lower() for item in detail)


def test_login_success():
    user = _user()
    with patch("auth.router.authenticate_user", new_callable=AsyncMock, return_value=user):
        response = client.post(
            "/auth/login",
            json={"login": "alice", "password": STRONG_PASSWORD},
        )
    assert response.status_code == 200
    assert "access_token" in response.json()


def test_login_invalid_credentials():
    with patch(
        "auth.router.authenticate_user",
        new_callable=AsyncMock,
        side_effect=InvalidCredentialsError("Invalid username/email or password."),
    ):
        response = client.post(
            "/auth/login",
            json={"login": "alice", "password": "wrong"},
        )
    assert response.status_code == 401


def test_login_inactive_account():
    with patch(
        "auth.router.authenticate_user",
        new_callable=AsyncMock,
        side_effect=AccountInactiveError("Account is disabled."),
    ):
        response = client.post(
            "/auth/login",
            json={"login": "alice", "password": STRONG_PASSWORD},
        )
    assert response.status_code == 401
    assert response.json()["detail"] == "Account is disabled."


def test_login_with_email_success():
    user = _user()
    with patch("auth.router.authenticate_user", new_callable=AsyncMock, return_value=user) as mock_auth:
        response = client.post(
            "/auth/login",
            json={"login": "alice@example.com", "password": STRONG_PASSWORD},
        )
    assert response.status_code == 200
    mock_auth.assert_awaited_once_with("alice@example.com", STRONG_PASSWORD)


def test_protected_route_requires_auth():
    response = client.get("/config/tracker")
    assert response.status_code == 401


def test_protected_route_accepts_bearer_token():
    user = _user()
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        username=user.username,
    )

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    response = client.get(
        "/config/tracker",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    body = response.json()
    assert "categories" in body
    assert "payment_methods" in body


def test_user_isolation_update_other_users_transaction_404():
    """User A cannot update a transaction owned by user B (filtered WHERE)."""
    user_a = _user()

    async def override_current_user():
        return user_a

    app.dependency_overrides[get_current_user] = override_current_user

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)
    mock_cm = AsyncMock()
    mock_cm.__aenter__.return_value = mock_session
    mock_cm.__aexit__.return_value = None

    with patch("tracker.router.transactions.get_connection", return_value=mock_cm):
        response = client.patch(
            "/transactions/00000000-0000-0000-0000-000000000001",
            json={"amount": 10},
            headers={"Authorization": "Bearer unused"},
        )
    assert response.status_code == 404
