"""Transaction CSV import preview and reviewed commit."""

from datetime import date
from unittest.mock import AsyncMock, patch
import uuid

import pytest
from fastapi.testclient import TestClient

import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from auth.deps import get_current_user
from auth.models import User
from auth.security import create_access_token
from main import app
from tracker.schemas import (
    ImportPreviewResponse,
    ImportPreviewRow,
    ReviewedImportRequest,
    ReviewedImportRow,
    ReviewedImportResponse,
)
from tracker.services import import_reviewed_transactions, preview_transactions_import

client = TestClient(app)

pytestmark = pytest.mark.anyio

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


async def test_preview_returns_all_rows_with_field_issues():
    csv_bytes = (
        b"transaction_date,category,amount,is_debit,payment_method\n"
        b"2026-03-01,Grocery,100,true,UPI\n"
        b",Dining,50,true,Card\n"
        b"2099-01-01,Grocery,10,true,\n"
        b"2026-03-02,Pet Care,25,true,\n"
    )

    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"grocery": "Grocery", "dining": "Dining"}),
    ):
        preview = await preview_transactions_import(csv_bytes)

    assert len(preview.rows) == 4
    assert preview.valid_row_count == 1
    assert preview.rows[0].source_row == 2
    assert preview.rows[0].is_ready is True
    assert preview.rows[1].source_row == 3
    assert any(issue.field == "transaction_date" for issue in preview.rows[1].issues)
    assert preview.rows[2].source_row == 4
    assert any(issue.field == "transaction_date" for issue in preview.rows[2].issues)
    assert preview.rows[3].category_is_new is True
    assert any(issue.code == "unknown_category" for issue in preview.rows[3].issues)


def test_import_preview_endpoint_returns_rows():
    headers = _auth_headers()
    csv_bytes = (
        b"transaction_date,category,amount,is_debit\n"
        b"2026-03-01,Grocery,100,true\n"
        b"2026-03-02,Pet Care,50,true\n"
    )

    preview = ImportPreviewResponse(
        rows=[
            ImportPreviewRow(
                source_row=2,
                transaction_date="2026-03-01",
                category="Grocery",
                amount="100",
                is_debit="true",
                issues=[],
                is_ready=True,
                category_is_new=False,
            )
        ],
        new_categories=["Pet Care"],
        valid_row_count=1,
    )

    with patch(
        "tracker.router.transactions.preview_transactions_import",
        new=AsyncMock(return_value=preview),
    ):
        response = client.post(
            "/transactions/import/preview",
            headers=headers,
            files={"file": ("rows.csv", csv_bytes, "text/csv")},
        )
    assert response.status_code == 200
    body = response.json()
    assert body["valid_row_count"] == 1
    assert body["new_categories"] == ["Pet Care"]
    assert len(body["rows"]) == 1


async def test_reviewed_import_inserts_selected_rows():
    payload = ReviewedImportRequest(
        rows=[
            ReviewedImportRow(
                source_row=2,
                amount=100,
                category="Grocery",
                transaction_date=date(2026, 3, 1),
                is_debit=True,
            )
        ],
        approved_new_categories=[],
    )

    with patch(
        "tracker.services.resolve_category_name",
        new=AsyncMock(return_value="Grocery"),
    ), patch("tracker.services.get_connection") as mock_conn:
        session = AsyncMock()
        mock_conn.return_value.__aenter__.return_value = session
        result = await import_reviewed_transactions(payload, user_id=ALICE_ID)

    assert result.inserted == 1
    assert result.errors == []
    session.execute.assert_awaited_once()


async def test_reviewed_import_rejects_unapproved_new_category():
    payload = ReviewedImportRequest(
        rows=[
            ReviewedImportRow(
                source_row=2,
                amount=50,
                category="Pet Care",
                transaction_date=date(2026, 3, 2),
                is_debit=True,
            )
        ],
        approved_new_categories=[],
    )

    with patch(
        "tracker.services.resolve_category_name",
        new=AsyncMock(side_effect=ValueError('Unknown category "Pet Care".')),
    ):
        result = await import_reviewed_transactions(payload, user_id=ALICE_ID)

    assert result.inserted == 0
    assert len(result.errors) == 1
    assert "Pet Care" in result.errors[0]


def test_reviewed_import_endpoint():
    headers = _auth_headers()
    with patch(
        "tracker.router.transactions.import_reviewed_transactions",
        new=AsyncMock(
            return_value=ReviewedImportResponse(
                inserted=1,
                created_categories=["Pet Care"],
                errors=[],
            )
        ),
    ):
        response = client.post(
            "/transactions/import/reviewed",
            headers=headers,
            json={
                "rows": [
                    {
                        "source_row": 2,
                        "amount": 50,
                        "category": "Pet Care",
                        "transaction_date": "2026-03-02",
                        "is_debit": True,
                        "payment_method": None,
                        "description": None,
                    }
                ],
                "approved_new_categories": ["Pet Care"],
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert body["inserted"] == 1
    assert body["created_categories"] == ["Pet Care"]
