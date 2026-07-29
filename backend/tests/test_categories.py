"""Category validation and API behaviour (DB mocked)."""

from datetime import date
from unittest.mock import AsyncMock, patch
import uuid

from fastapi.testclient import TestClient

import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from auth.deps import get_current_user
from auth.models import User
from auth.security import create_access_token
from main import app
from tracker.category_service import (
    CategoryInfo,
    category_key,
    normalize_category_name,
    validate_category_name,
)
from tracker.schemas import TransactionCreate

client = TestClient(app)

ALICE_ID = uuid.UUID("11111111-1111-1111-1111-111111111111")


def _user() -> User:
    return User(
        id=ALICE_ID,
        username="alice",
        email="alice@example.com",
        password_hash="x",
        first_name=None,
        last_name=None,
        preferences={"theme": "light"},
        is_active=True,
        version_no=0,
    )


def _auth_headers() -> dict[str, str]:
    user = _user()
    token = create_access_token(
        user_id=user.id,
        email=user.email,
        username=user.username,
    )

    async def override_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_current_user
    return {"Authorization": f"Bearer {token}"}


def test_normalize_and_casefold_merge():
    assert normalize_category_name("  Pet   Care ") == "Pet Care"
    assert category_key("Dining") == category_key("dining")
    assert category_key("Other Income") == "other income"


def test_validate_category_name_rejects_empty_and_long():
    try:
        validate_category_name("   ")
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "category name" in str(exc).lower()

    try:
        validate_category_name("x" * 41)
        assert False, "expected ValueError"
    except ValueError as exc:
        assert "40" in str(exc)


def test_transaction_create_accepts_any_nonempty_category_string():
    tx = TransactionCreate(
        amount=10,
        category="  Pet Care ",
        transaction_date=date.today(),
    )
    assert tx.category == "Pet Care"


def test_create_category_endpoint_validates_without_table():
    headers = _auth_headers()
    with patch(
        "tracker.router.categories.register_category_name",
        new=AsyncMock(return_value=CategoryInfo(name="Pet Care", is_system=False)),
    ):
        response = client.post("/categories", json={"name": "Pet Care"}, headers=headers)
    assert response.status_code == 201
    body = response.json()
    assert body["name"] == "Pet Care"
    assert body["is_system"] is False
    assert "id" not in body


def test_rename_category_endpoint():
    headers = _auth_headers()
    with patch(
        "tracker.router.categories.rename_category",
        new=AsyncMock(return_value=CategoryInfo(name="Pets", is_system=False)),
    ):
        response = client.patch(
            "/categories",
            json={"old_name": "Pet Care", "new_name": "Pets"},
            headers=headers,
        )
    assert response.status_code == 200
    assert response.json()["name"] == "Pets"


def test_import_preview_reports_new_categories():
    headers = _auth_headers()
    csv_bytes = (
        b"transaction_date,category,amount,is_debit\n"
        b"2026-03-01,Pet Care,100,true\n"
        b"2026-03-02,Grocery,50,true\n"
    )

    with patch(
        "tracker.router.transactions.preview_transactions_import",
        new=AsyncMock(
            return_value={
                "valid_row_count": 2,
                "new_categories": ["Pet Care"],
                "errors": [],
            }
        ),
    ):
        response = client.post(
            "/transactions/import/preview",
            headers=headers,
            files={"file": ("rows.csv", csv_bytes, "text/csv")},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["valid_row_count"] == 2
    assert body["new_categories"] == ["Pet Care"]
