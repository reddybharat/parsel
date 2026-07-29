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
from tracker.category_service import CategoryInfo

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
    first_name: str | None = None,
    last_name: str | None = None,
    preferences: dict | None = None,
    version_no: int = 0,
) -> User:
    return User(
        id=user_id,
        username=username,
        email=email,
        password_hash=hash_password(STRONG_PASSWORD),
        first_name=first_name,
        last_name=last_name,
        preferences=preferences if preferences is not None else {"theme": "light"},
        version_no=version_no,
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
    fake_categories = [
        CategoryInfo(name="Grocery", is_system=True),
        CategoryInfo(name="Dining", is_system=True),
    ]
    with patch(
        "tracker.router.config.list_categories",
        new=AsyncMock(return_value=fake_categories),
    ):
        response = client.get(
            "/config/tracker",
            headers={"Authorization": f"Bearer {token}"},
        )
    assert response.status_code == 200
    body = response.json()
    assert "categories" in body
    assert "payment_methods" in body
    assert body["categories"][0]["name"] == "Grocery"
    assert body["categories"][0]["is_system"] is True
    assert "id" not in body["categories"][0]


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


def test_get_me_returns_profile():
    user = _user(first_name="Alice", preferences={"theme": "dark"})

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    response = client.get("/auth/me", headers={"Authorization": "Bearer unused"})
    assert response.status_code == 200
    body = response.json()
    assert body["username"] == "alice"
    assert body["email"] == "alice@example.com"
    assert body["first_name"] == "Alice"
    assert body["last_name"] is None
    assert body["preferences"] == {"theme": "dark"}
    assert "access_token" not in body


def test_patch_me_updates_names_and_theme():
    user = _user(version_no=2)
    updated = _user(
        first_name="Ali",
        last_name="Smith",
        preferences={"theme": "dark"},
        version_no=3,
    )

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    with patch("auth.router.update_me", new_callable=AsyncMock, return_value=updated) as mock_update:
        response = client.patch(
            "/auth/me",
            json={
                "first_name": "Ali",
                "last_name": "Smith",
                "preferences": {"theme": "dark"},
            },
            headers={"Authorization": "Bearer unused"},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["first_name"] == "Ali"
    assert body["last_name"] == "Smith"
    assert body["preferences"] == {"theme": "dark"}
    assert isinstance(body["access_token"], str) and body["access_token"]
    mock_update.assert_awaited_once()
    kwargs = mock_update.await_args.kwargs
    assert kwargs["first_name"] == "Ali"
    assert kwargs["last_name"] == "Smith"
    assert kwargs["preferences"] == {"theme": "dark"}


def test_patch_me_username_taken_conflict():
    user = _user()

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    with patch(
        "auth.router.update_me",
        new_callable=AsyncMock,
        side_effect=UsernameAlreadyTakenError("Username is already taken."),
    ):
        response = client.patch(
            "/auth/me",
            json={"username": "bob"},
            headers={"Authorization": "Bearer unused"},
        )
    assert response.status_code == 409
    assert response.json()["detail"] == "Username is already taken."


def test_patch_me_rejects_invalid_username():
    user = _user()

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    response = client.patch(
        "/auth/me",
        json={"username": "bad name!"},
        headers={"Authorization": "Bearer unused"},
    )
    assert response.status_code == 422


def test_patch_me_rejects_invalid_theme():
    user = _user()

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    response = client.patch(
        "/auth/me",
        json={"preferences": {"theme": "neon"}},
        headers={"Authorization": "Bearer unused"},
    )
    assert response.status_code == 422


def test_refresh_after_username_change_uses_current_user():
    user = _user(username="alice_new")

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    response = client.post("/auth/refresh", headers={"Authorization": "Bearer unused"})
    assert response.status_code == 200
    token = response.json()["access_token"]
    from auth.security import decode_access_token

    claims = decode_access_token(token)
    assert claims["username"] == "alice_new"


def test_change_password_success():
    user = _user()

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    updated = _user(version_no=1)
    with patch(
        "auth.router.change_password",
        new_callable=AsyncMock,
        return_value=updated,
    ) as mock_change:
        response = client.post(
            "/auth/change-password",
            json={
                "current_password": STRONG_PASSWORD,
                "new_password": "Password2!",
                "confirm_password": "Password2!",
            },
            headers={"Authorization": "Bearer unused"},
        )
    assert response.status_code == 200
    assert isinstance(response.json()["access_token"], str)
    mock_change.assert_awaited_once_with(
        user.id,
        current_password=STRONG_PASSWORD,
        new_password="Password2!",
    )


def test_change_password_rejects_wrong_current():
    user = _user()

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    with patch(
        "auth.router.change_password",
        new_callable=AsyncMock,
        side_effect=InvalidCredentialsError("Current password is incorrect."),
    ):
        response = client.post(
            "/auth/change-password",
            json={
                "current_password": "WrongPass1!",
                "new_password": "Password2!",
                "confirm_password": "Password2!",
            },
            headers={"Authorization": "Bearer unused"},
        )
    assert response.status_code == 400
    assert response.json()["detail"] == "Current password is incorrect."


def test_change_password_rejects_mismatch():
    user = _user()

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    response = client.post(
        "/auth/change-password",
        json={
            "current_password": STRONG_PASSWORD,
            "new_password": "Password2!",
            "confirm_password": "Password3!",
        },
        headers={"Authorization": "Bearer unused"},
    )
    assert response.status_code == 422
