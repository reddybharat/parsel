"""Transaction CSV/Excel import preview and reviewed commit."""

from datetime import date
from io import BytesIO
from unittest.mock import AsyncMock, patch
import uuid

import openpyxl
import pytest
from fastapi.testclient import TestClient

import os

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from auth.deps import get_current_user
from auth.models import User
from auth.security import create_access_token
from main import app
from tracker.bank_import.sbi import BankStatementPasswordError, extract_sbi_rows
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


def _sbi_xlsx_bytes() -> bytes:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(["Account holder"])
    ws.append(["Statement From  :  01-03-2026  to  29-07-2026"])
    ws.append(["Date", "Details", "Ref No/Cheque No", "Debit", "Credit", "Balance"])
    ws.append(["05/03/2026", "DIRECT DR EMI", "", "1500.00", "", "178167.47"])
    ws.append(["09/03/2026", "UPI CREDIT", "", "", "30000.00", "208167.47"])
    ws.append([])
    ws.append(["Statement Summary : 01-03-2026  To  29-07-2026"])
    buf = BytesIO()
    wb.save(buf)
    return buf.getvalue()


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
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=["Pet Care"]),
    ):
        preview = await preview_transactions_import(
            csv_bytes,
            user_id=ALICE_ID,
            bank="SBI",
        )

    assert len(preview.rows) == 4
    assert preview.valid_row_count == 1
    assert preview.rows[0].source_row == 2
    assert preview.rows[0].is_ready is True
    assert preview.rows[0].bank == "SBI"
    assert preview.rows[1].source_row == 3
    assert any(issue.field == "transaction_date" for issue in preview.rows[1].issues)
    assert preview.rows[2].source_row == 4
    assert any(issue.field == "transaction_date" for issue in preview.rows[2].issues)
    assert preview.rows[3].category_is_new is True
    assert any(issue.code == "unknown_category" for issue in preview.rows[3].issues)


async def test_preview_blank_category_is_not_ready():
    csv_bytes = (
        b"transaction_date,category,amount,is_debit\n"
        b"2026-03-01,,100,true\n"
    )
    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"grocery": "Grocery"}),
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=[]),
    ):
        preview = await preview_transactions_import(
            csv_bytes,
            user_id=ALICE_ID,
            bank="Kotak",
        )

    assert len(preview.rows) == 1
    assert preview.rows[0].is_ready is False
    assert preview.rows[0].bank == "Kotak"
    assert any(
        issue.field == "category" and issue.code == "required"
        for issue in preview.rows[0].issues
    )


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
                bank="SBI",
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
            data={"bank": "SBI"},
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
                bank="SBI",
                transaction_date=date(2026, 3, 1),
                is_debit=True,
            )
        ],
        approved_new_categories=[],
    )

    with patch(
        "tracker.services.resolve_category_name",
        new=AsyncMock(return_value="Grocery"),
    ), patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"grocery": "Grocery"}),
    ), patch("tracker.services.get_connection") as mock_conn:
        session = AsyncMock()
        mock_conn.return_value.__aenter__.return_value = session
        result = await import_reviewed_transactions(payload, user_id=ALICE_ID)

    assert result.inserted == 1
    assert result.errors == []
    session.execute.assert_awaited_once()
    rows = session.execute.await_args.args[1]
    assert rows[0]["bank"] == "SBI"


async def test_reviewed_import_rejects_unapproved_new_category():
    payload = ReviewedImportRequest(
        rows=[
            ReviewedImportRow(
                source_row=2,
                amount=50,
                category="Pet Care",
                bank="Slice",
                transaction_date=date(2026, 3, 2),
                is_debit=True,
            )
        ],
        approved_new_categories=[],
    )

    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"grocery": "Grocery"}),
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
                        "bank": "SBI",
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


def test_extract_sbi_rows_from_xlsx():
    rows = extract_sbi_rows(_sbi_xlsx_bytes())
    assert len(rows) == 2
    assert rows[0].transaction_date == "2026-03-05"
    assert rows[0].amount == "1500.00"
    assert rows[0].is_debit == "true"
    assert rows[1].transaction_date == "2026-03-09"
    assert rows[1].amount == "30000.00"
    assert rows[1].is_debit == "false"


def test_to_iso_date_accepts_sbi_formats():
    from datetime import date, datetime

    from tracker.bank_import.sbi import _to_iso_date

    assert _to_iso_date("05/03/2026") == "2026-03-05"
    assert _to_iso_date("25-03-2026") == "2026-03-25"
    assert _to_iso_date("05.03.2026") == "2026-03-05"
    assert _to_iso_date(date(2026, 3, 5)) == "2026-03-05"
    assert _to_iso_date(datetime(2026, 3, 5, 10, 30)) == "2026-03-05"
    assert _to_iso_date("2026-03-05") == "2026-03-05"


async def test_preview_sbi_xlsx_blank_category():
    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={}),
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=[]),
    ):
        preview = await preview_transactions_import(
            _sbi_xlsx_bytes(),
            user_id=ALICE_ID,
            bank="SBI",
            filename="statement.xlsx",
        )

    assert len(preview.rows) == 2
    assert preview.valid_row_count == 0
    assert all(row.category == "" for row in preview.rows)
    assert all(row.bank == "SBI" for row in preview.rows)
    assert any(issue.field == "category" for issue in preview.rows[0].issues)


async def test_preview_xlsx_unsupported_for_kotak():
    preview = await preview_transactions_import(
        _sbi_xlsx_bytes(),
        user_id=ALICE_ID,
        bank="Kotak",
        filename="statement.xlsx",
    )
    assert preview.rows == []
    assert preview.file_errors
    assert "not supported" in preview.file_errors[0].lower()


async def test_preview_password_required_error():
    with patch(
        "tracker.services.extract_sbi_rows",
        side_effect=BankStatementPasswordError("Password required to open this file."),
    ):
        preview = await preview_transactions_import(
            b"fake",
            user_id=ALICE_ID,
            bank="SBI",
            filename="locked.xlsx",
        )
    assert preview.rows == []
    assert preview.file_errors == ["Password required to open this file."]
