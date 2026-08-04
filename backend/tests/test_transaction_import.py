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


@pytest.fixture(autouse=True)
def _no_existing_duplicates():
    """Preview/commit tests default to an empty ledger unless they opt into duplicates."""
    with patch(
        "tracker.services._load_existing_duplicate_keys",
        new=AsyncMock(return_value=set()),
    ):
        yield


@pytest.fixture(autouse=True)
def _all_banks_active():
    """Treat every catalog bank as an active profile bank for import tests."""
    with patch(
        "tracker.bank_service.list_active_bank_names",
        new=AsyncMock(return_value=["SBI", "Kotak", "Slice"]),
    ):
        yield


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


def _make_text_pdf(lines: list[str], password: str | None = None) -> bytes:
    """Minimal Helvetica PDF for parser/password tests (no third-party writer)."""
    from io import BytesIO

    from pypdf import PdfReader, PdfWriter

    ops = ["BT", "/F1 9 Tf", "50 750 Td", "11 TL"]
    for i, line in enumerate(lines):
        esc = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
        esc = esc.encode("latin-1", "replace").decode("latin-1")
        if i:
            ops.append("T*")
        ops.append(f"({esc}) Tj")
    ops.append("ET")
    stream = ("\n".join(ops)).encode("latin-1")

    pieces: list[bytes] = []
    offsets: list[int] = []

    def add(data: bytes) -> None:
        pieces.append(data)

    def add_obj(n: int, body: bytes) -> None:
        offsets.append(sum(len(p) for p in pieces))
        add(f"{n} 0 obj\n".encode("ascii"))
        add(body)
        add(b"\nendobj\n")

    add(b"%PDF-1.4\n")
    add_obj(1, b"<< /Type /Catalog /Pages 2 0 R >>")
    add_obj(2, b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>")
    add_obj(
        3,
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    )
    add_obj(4, b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream")
    add_obj(5, b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    xref_pos = sum(len(p) for p in pieces)
    add(f"xref\n0 {len(offsets) + 1}\n".encode("ascii"))
    add(b"0000000000 65535 f \n")
    for off in offsets:
        add(f"{off:010d} 00000 n \n".encode("ascii"))
    add(
        f"trailer<< /Size {len(offsets) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF\n".encode("ascii")
    )
    data = b"".join(pieces)
    if not password:
        return data
    reader = PdfReader(BytesIO(data))
    writer = PdfWriter()
    writer.append(reader)
    writer.encrypt(password)
    buf = BytesIO()
    writer.write(buf)
    return buf.getvalue()


def _slice_pdf_bytes(password: str | None = None) -> bytes:
    return _make_text_pdf(
        [
            "01 Jul '26 - 31 Jul '26",
            "Opening balance Total credits Interest earned Total debits Closing balance",
            "Rs.0.00 Rs.100.00 Rs.5.00 Rs.20.00 Rs.85.00",
            "DATE DETAILS REF NO. AMOUNT BALANCE",
            "19 Jul '26 620000158761/Add Funds 202262001947414 Rs.100.00 Rs.100.00",
            "20 Jul '26 Interest Cr. for 19/Jul/2026 2022620159004 Rs.5.00 Rs.105.00",
            "21 Jul '26 UPI/Merchant/Payment 2022620252064 Rs.20.00 Rs.85.00",
            "Need help? Contact our support team",
        ],
        password=password,
    )


def _kotak_pdf_bytes(password: str | None = None) -> bytes:
    return _make_text_pdf(
        [
            "Account Statement 01 Jul 2026 - 31 Jul 2026",
            "Savings Account Transactions",
            "# Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance",
            "- - Opening Balance - - - 1,000.00",
            "1 02 Jul 2026 UPI/Coffee Shop/Payment from",
            "UPI-111 100.00 900.00",
            "2 03 Jul 2026 NEFT SALARY CREDIT",
            "NEFTINW-222 500.00 1,400.00",
            "3 04 Jul 2026 UPI/GROCER/YESB/333/Payment",
            "UPI-333 50.00 1,350.00",
            "Statement Generated on 01 Aug 2026 Page 1 of 2",
            "End of Statement",
            "Account Summary Closing Balance 1,350.00",
            "Important Information ignore this page",
        ],
        password=password,
    )


def test_detect_import_kind_pdf():
    from tracker.services import _detect_import_kind

    assert _detect_import_kind("stmt.pdf", b"%PDF-1.7 anything") == "pdf"
    assert _detect_import_kind(None, b"  %PDF-1.4") == "pdf"
    assert _detect_import_kind("stmt.PDF", b"not pdf magic") == "pdf"


def test_parse_slice_statement_text_debit_and_credit():
    from tracker.bank_import.slice_pdf import parse_slice_statement_text

    text = "\n".join(
        [
            "Opening balance",
            "Rs.0.00 Rs.100.00 Rs.5.00 Rs.20.00 Rs.85.00",
            "DATE DETAILS REF NO. AMOUNT BALANCE",
            "19 Jul '26 620000158761/Add Funds 202262001947414 Rs.100.00 Rs.100.00",
            "20 Jul '26 Interest Cr. for 19/Jul/2026 2022620159004 Rs.5.00 Rs.105.00",
            "21 Jul '26 UPI/Merchant/Payment 2022620252064 Rs.20.00 Rs.85.00",
            "Need help? Contact our support team",
        ]
    )
    rows = parse_slice_statement_text(text)
    assert len(rows) == 3
    assert rows[0].transaction_date == "2026-07-19"
    assert rows[0].amount == "100.00"
    assert rows[0].is_debit == "false"
    assert rows[0].category == ""
    assert "Add Funds" in rows[0].description
    assert rows[1].is_debit == "false"
    assert rows[1].category == "Other Income"
    assert rows[2].amount == "20.00"
    assert rows[2].is_debit == "true"
    assert rows[2].category == ""


def test_parse_kotak_statement_text_multiline_and_end_marker():
    from tracker.bank_import.kotak_pdf import parse_kotak_statement_text

    text = "\n".join(
        [
            "# Date Description Chq/Ref. No. Withdrawal (Dr.) Deposit (Cr.) Balance",
            "- - Opening Balance - - - 1,000.00",
            "1 02 Jul 2026 UPI/Coffee Shop/Payment from",
            "UPI-111 100.00 900.00",
            "2 03 Jul 2026 NEFT SALARY CREDIT",
            "NEFTINW-222 500.00 1,400.00",
            "3 04 Jul 2026 UPI/GROCER/YESB/333/Payment",
            "UPI-333 50.00 1,350.00",
            "End of Statement",
            "99 05 Jul 2026 FAKE AFTER END 10.00 1,340.00",
        ]
    )
    rows = parse_kotak_statement_text(text)
    assert len(rows) == 3
    assert rows[0].source_row == 1
    assert rows[0].is_debit == "true"
    assert rows[0].amount == "100.00"
    assert "Coffee Shop" in rows[0].description
    assert rows[1].is_debit == "false"
    assert rows[1].amount == "500.00"
    assert rows[2].is_debit == "true"
    assert all(r.source_row != 99 for r in rows)


def test_extract_slice_pdf_rows_password():
    from tracker.bank_import.errors import BankStatementPasswordError
    from tracker.bank_import.slice_pdf import extract_slice_pdf_rows

    locked = _slice_pdf_bytes(password="secret")
    with pytest.raises(BankStatementPasswordError):
        extract_slice_pdf_rows(locked)
    with pytest.raises(BankStatementPasswordError):
        extract_slice_pdf_rows(locked, password="wrong")
    rows = extract_slice_pdf_rows(locked, password="secret")
    assert len(rows) == 3
    assert rows[0].is_debit == "false"
    assert rows[2].is_debit == "true"


def test_extract_kotak_pdf_rows():
    from tracker.bank_import.kotak_pdf import extract_kotak_pdf_rows

    rows = extract_kotak_pdf_rows(_kotak_pdf_bytes())
    assert len(rows) == 3
    assert rows[0].transaction_date == "2026-07-02"
    assert rows[1].amount == "500.00"
    assert rows[1].is_debit == "false"


async def test_preview_slice_pdf():
    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"other income": "Other Income"}),
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=[]),
    ):
        preview = await preview_transactions_import(
            _slice_pdf_bytes(),
            user_id=ALICE_ID,
            bank="Slice",
            filename="slice.pdf",
        )
    assert len(preview.rows) == 3
    assert all(row.bank == "Slice" for row in preview.rows)
    assert preview.rows[0].is_debit == "false"
    assert preview.rows[0].category == ""
    assert preview.rows[1].category == "Other Income"
    assert preview.rows[1].category_is_new is False
    assert preview.rows[2].is_debit == "true"
    assert preview.rows[2].category == ""
    assert any(issue.field == "category" for issue in preview.rows[0].issues)
    assert not any(issue.field == "category" for issue in preview.rows[1].issues)
    assert preview.rows[1].is_ready is True


async def test_preview_kotak_pdf():
    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={}),
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=[]),
    ):
        preview = await preview_transactions_import(
            _kotak_pdf_bytes(password="bankpw"),
            user_id=ALICE_ID,
            bank="Kotak",
            password="bankpw",
            filename="kotak.pdf",
        )
    assert len(preview.rows) == 3
    assert all(row.bank == "Kotak" for row in preview.rows)


def _sbi_pdf_bytes(password: str | None = None) -> bytes:
    return _make_text_pdf(
        [
            "STATEMENT OF ACCOUNT",
            "State Bank of India",
            "Balance",
            "05/03/2026 05/03/2026",
            "DIRECT DR   0043997836858 OF",
            "Mr TEST USER AT 02053",
            "- 1,500.00 - 1,78,167.47",
            "09/03/2026 09/03/2026",
            "DEP TFR",
            "UPI/CR/643475486685/TEST",
            "- - 30,000.00 2,08,167.47",
            "25/03/2026 25/03/2026 INTEREST CREDIT - - 1,279.00 2,09,447.47",
            "27/03/2026 27/03/2026",
            "ATM WDL   ATM CASH",
            "- 5,000.00 - 2,04,447.47",
            "1Page no.",
            "Statement Summary : 01-03-2026 To 02-08-2026",
            "Brought Forward Dr Count Cr Count",
        ],
        password=password,
    )


def test_parse_sbi_pdf_statement_text_debit_credit_and_interest():
    from tracker.bank_import.sbi_pdf import parse_sbi_pdf_statement_text

    text = "\n".join(
        [
            "Balance",
            "05/03/2026 05/03/2026",
            "DIRECT DR   0043997836858 OF",
            "Mr TEST USER AT 02053",
            "- 1,500.00 - 1,78,167.47",
            "09/03/2026 09/03/2026",
            "DEP TFR UPI/CR/123/TEST",
            "- - 30,000.00 2,08,167.47",
            "25/03/2026 25/03/2026 INTEREST CREDIT - - 1,279.00 2,09,447.47",
            "Statement Summary : 01-03-2026 To 02-08-2026",
        ]
    )
    rows = parse_sbi_pdf_statement_text(text)
    assert len(rows) == 3
    assert rows[0].transaction_date == "2026-03-05"
    assert rows[0].amount == "1500.00"
    assert rows[0].is_debit == "true"
    assert "DIRECT DR" in rows[0].description
    assert rows[1].is_debit == "false"
    assert rows[1].amount == "30000.00"
    assert rows[2].description == "INTEREST CREDIT"
    assert rows[2].category == "Other Income"
    assert rows[2].is_debit == "false"


def test_extract_sbi_pdf_rows_password():
    from tracker.bank_import.errors import BankStatementPasswordError
    from tracker.bank_import.sbi_pdf import extract_sbi_pdf_rows

    locked = _sbi_pdf_bytes(password="secret")
    with pytest.raises(BankStatementPasswordError):
        extract_sbi_pdf_rows(locked)
    rows = extract_sbi_pdf_rows(locked, password="secret")
    assert len(rows) == 4
    assert rows[0].is_debit == "true"
    assert rows[1].is_debit == "false"
    assert rows[2].category == "Other Income"


async def test_preview_sbi_pdf():
    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"other income": "Other Income"}),
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=[]),
    ):
        preview = await preview_transactions_import(
            _sbi_pdf_bytes(),
            user_id=ALICE_ID,
            bank="SBI",
            filename="sbi.pdf",
        )
    assert len(preview.rows) == 4
    assert all(row.bank == "SBI" for row in preview.rows)
    assert preview.rows[0].is_debit == "true"
    assert preview.rows[2].category == "Other Income"
    assert preview.rows[2].is_ready is True


async def test_preview_flags_intra_file_duplicates():
    csv_bytes = (
        b"transaction_date,category,amount,is_debit,description\n"
        b"2026-03-01,Grocery,100,true,Same txn\n"
        b"2026-03-01,Grocery,100,true,Different wording\n"
        b"2026-03-02,Grocery,50,true,Other\n"
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
            bank="SBI",
        )

    assert preview.duplicate_row_count == 1
    assert preview.rows[0].is_duplicate is False
    assert preview.rows[1].is_duplicate is True
    assert any(issue.code == "duplicate" for issue in preview.rows[1].issues)
    assert preview.rows[2].is_duplicate is False
    assert preview.valid_row_count == 2


async def test_preview_flags_existing_ledger_duplicates():
    from datetime import date as date_cls

    from tracker.services import _duplicate_key

    existing_key = _duplicate_key(
        bank="Kotak",
        transaction_date=date_cls(2026, 3, 1),
        amount=100.0,
        is_debit=True,
    )
    csv_bytes = (
        b"transaction_date,category,amount,is_debit,description\n"
        b"2026-03-01,Grocery,100,true,Manual note\n"
        b"2026-03-02,Grocery,50,true,Tea\n"
    )
    with patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"grocery": "Grocery"}),
    ), patch(
        "tracker.services.list_missing_category_names",
        new=AsyncMock(return_value=[]),
    ), patch(
        "tracker.services._load_existing_duplicate_keys",
        new=AsyncMock(return_value={existing_key}),
    ):
        preview = await preview_transactions_import(
            csv_bytes,
            user_id=ALICE_ID,
            bank="Kotak",
        )

    assert preview.rows[0].is_duplicate is True
    assert preview.rows[1].is_duplicate is False
    assert preview.duplicate_row_count == 1


async def test_reviewed_import_skips_duplicates_unless_forced():
    from datetime import date as date_cls

    from tracker.services import _duplicate_key

    existing_key = _duplicate_key(
        bank="SBI",
        transaction_date=date_cls(2026, 3, 1),
        amount=100.0,
        is_debit=True,
    )
    payload = ReviewedImportRequest(
        rows=[
            ReviewedImportRow(
                source_row=2,
                amount=100,
                category="Grocery",
                bank="SBI",
                transaction_date=date_cls(2026, 3, 1),
                is_debit=True,
                description="Imported wording",
                force_duplicate=False,
            ),
            ReviewedImportRow(
                source_row=3,
                amount=50,
                category="Grocery",
                bank="SBI",
                transaction_date=date_cls(2026, 3, 2),
                is_debit=True,
                description="Other",
                force_duplicate=False,
            ),
            ReviewedImportRow(
                source_row=4,
                amount=100,
                category="Grocery",
                bank="SBI",
                transaction_date=date_cls(2026, 3, 1),
                is_debit=True,
                description="Forced duplicate",
                force_duplicate=True,
            ),
        ],
        approved_new_categories=[],
    )

    with patch(
        "tracker.services.resolve_category_name",
        new=AsyncMock(return_value="Grocery"),
    ), patch(
        "tracker.services.known_category_map",
        new=AsyncMock(return_value={"grocery": "Grocery"}),
    ), patch(
        "tracker.services._load_existing_duplicate_keys",
        new=AsyncMock(return_value={existing_key}),
    ), patch("tracker.services.get_connection") as mock_conn:
        session = AsyncMock()
        mock_conn.return_value.__aenter__.return_value = session
        result = await import_reviewed_transactions(payload, user_id=ALICE_ID)

    assert result.inserted == 2
    assert result.skipped_duplicates == 1
    assert result.errors == []
    session.execute.assert_awaited_once()
    rows = session.execute.await_args.args[1]
    assert len(rows) == 2
    assert {row["description"] for row in rows} == {"Forced duplicate", "Other"}


def test_csv_template_includes_bank_column():
    from tracker.services import CSV_FIELDS, transactions_csv_template

    assert "bank" in CSV_FIELDS
    csv_text = transactions_csv_template()
    header = csv_text.splitlines()[0]
    assert header.split(",") == CSV_FIELDS
    assert "SBI" in csv_text
    assert "Kotak" in csv_text
    assert "Slice" in csv_text


async def test_export_transactions_csv_includes_bank():
    from tracker.services import export_transactions_csv

    mapping_rows = [
        {
            "transaction_date": date(2026, 3, 1),
            "category": "Grocery",
            "amount": 100,
            "is_debit": True,
            "description": "Milk",
            "payment_method": "UPI",
            "bank": "Kotak",
        },
        {
            "transaction_date": date(2026, 3, 2),
            "category": "Dining",
            "amount": 50,
            "is_debit": True,
            "description": "Lunch",
            "payment_method": "Card",
            "bank": None,
        },
    ]

    class _Result:
        def mappings(self):
            return self

        def all(self):
            return mapping_rows

    with patch("tracker.services.get_readonly_connection") as mock_conn:
        session = AsyncMock()
        session.execute = AsyncMock(return_value=_Result())
        mock_conn.return_value.__aenter__.return_value = session
        csv_text = await export_transactions_csv(
            date(2026, 3, 1),
            date(2026, 3, 31),
            category=None,
            user_id=ALICE_ID,
        )

    lines = csv_text.strip().splitlines()
    assert lines[0].endswith(",bank")
    assert "Kotak" in lines[1]
    assert lines[2].endswith(",")  # null bank exports as empty


async def test_preview_uses_per_row_csv_bank_over_form_bank():
    csv_bytes = (
        b"transaction_date,category,amount,is_debit,bank\n"
        b"2026-03-01,Grocery,100,true,Kotak\n"
        b"2026-03-02,Grocery,50,true,\n"
        b"2026-03-03,Grocery,25,true,NotABank\n"
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
            bank="SBI",
        )

    assert preview.rows[0].bank == "Kotak"
    assert preview.rows[0].is_ready is True
    assert preview.rows[1].bank == "SBI"
    assert preview.rows[1].is_ready is True
    assert preview.rows[2].bank == "NotABank"
    assert preview.rows[2].is_ready is False
    assert any(
        issue.field == "bank" and issue.code == "invalid_value"
        for issue in preview.rows[2].issues
    )


async def test_legacy_csv_import_uses_per_row_bank():
    from tracker.services import import_transactions_from_csv

    csv_bytes = (
        b"transaction_date,category,amount,is_debit,bank\n"
        b"2026-03-01,Grocery,100,true,Kotak\n"
        b"2026-03-02,Grocery,50,true,\n"
    )

    with patch(
        "tracker.services.resolve_category_name",
        new=AsyncMock(return_value="Grocery"),
    ), patch("tracker.services.get_connection") as mock_conn:
        session = AsyncMock()
        mock_conn.return_value.__aenter__.return_value = session
        inserted, errors, created = await import_transactions_from_csv(
            csv_bytes,
            user_id=ALICE_ID,
            bank="SBI",
            create_missing_categories=False,
        )

    assert errors == []
    assert inserted == 2
    assert created == []
    session.execute.assert_awaited_once()
    rows = session.execute.await_args.args[1]
    assert [row["bank"] for row in rows] == ["Kotak", "SBI"]
