"""
CSV export, template, and import for transactions.
Uses SQLAlchemy async session and tracker schemas; no UI dependencies.
"""

import asyncio
import csv
import io
import json
from datetime import date, datetime
from typing import Any, Optional
import uuid

from common.database import get_connection, get_readonly_connection
from pydantic import ValidationError
from sqlalchemy import or_, select, text

from tracker.category_service import (
    category_key,
    known_category_map,
    list_missing_category_names,
    normalize_category_name,
    register_category_names,
    resolve_category_name,
)
from tracker.bank_import import (
    BankStatementParseError,
    BankStatementPasswordError,
    extract_kotak_pdf_rows,
    extract_sbi_pdf_rows,
    extract_sbi_rows,
    extract_slice_pdf_rows,
)
from tracker.constants import (
    BANK_KOTAK,
    BANK_SBI,
    BANK_SLICE,
    BANKS,
    INVESTMENTS_CATEGORY,
    PAYMENT_METHODS,
    SELF_TRANSFER_CATEGORY,
    WALLET_TOP_UP_CATEGORY,
)
from tracker.models import Transaction
from tracker.schemas import (
    ImportFieldIssue,
    ImportPreviewResponse,
    ImportPreviewRow,
    ReviewedImportRequest,
    ReviewedImportResponse,
    ReviewedImportRow,
    TransactionCreate,
)

# CSV column names (used for export, template, and import)
CSV_FIELDS = [
    "transaction_date",
    "category",
    "amount",
    "is_debit",
    "description",
    "payment_method",
    "bank",
]


def transaction_text_search(term: str):
    """ILIKE contains-match over description, category, payment_method, and bank."""
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    pattern = f"%{escaped}%"
    return or_(
        Transaction.description.ilike(pattern),
        Transaction.category.ilike(pattern),
        Transaction.payment_method.ilike(pattern),
        Transaction.bank.ilike(pattern),
    )


def _normalize_bank(bank: str) -> str:
    s = (bank or "").strip()
    if s not in BANKS:
        raise ValueError(f"Invalid bank. Must be one of: {', '.join(BANKS)}")
    return s


def _parse_is_debit(raw: Optional[str]) -> bool:
    s = (raw or "").strip().lower()
    if not s:
        raise ValueError("is_debit is required when the column is present.")
    if s in {"true", "t", "1", "yes", "y"}:
        return True
    if s in {"false", "f", "0", "no", "n"}:
        return False
    raise ValueError(f"Invalid is_debit value '{raw}'. Expected true/false.")


def _parse_transaction_date(raw_date: str) -> date:
    """
    Parse CSV transaction_date and normalize to a `date` (YYYY-MM-DD).

    Accepts:
    - YYYY-MM-DD
    - YYYY-MM-DDTHH:MM:SS... / YYYY-MM-DD HH:MM:SS... (takes the date prefix)
    - Common slash/dot formats like MM/DD/YYYY or DD/MM/YYYY
    """
    s = (raw_date or "").strip()
    if not s:
        raise ValueError("transaction_date is required.")

    # Fast path: plain YYYY-MM-DD.
    if len(s) >= 10 and s[4] == "-" and s[7] == "-":
        try:
            return date.fromisoformat(s[:10])
        except ValueError:
            # Fall through to other formats.
            pass

    # datetime.fromisoformat handles many ISO-like variants; take date part.
    try:
        dt = datetime.fromisoformat(s.replace("Z", "+00:00"))
        return dt.date()
    except ValueError:
        pass

    # Common non-ISO formats (Excel/exports).
    # Handle slash formats with a heuristic to avoid MM/DD vs DD/MM mixups.
    if "/" in s:
        parts = s.split("/")
        if len(parts) == 3:
            p1, p2, p3 = parts
            if len(p1) == 4:  # YYYY/MM/DD
                year = int(p1)
                month = int(p2)
                day = int(p3)
                return date(year, month, day)

            # Otherwise assume last part is year (YY or YYYY).
            day_or_month_1 = int(p1)
            day_or_month_2 = int(p2)
            year_part = p3
            year = int(year_part)
            if len(year_part) == 2:
                # Simple 2-digit year mapping: 00-68 -> 2000-2068, else 1900-1999.
                year = 2000 + year if year <= 68 else 1900 + year

            # Disambiguate:
            # - If one component is > 12, it must be the day.
            # - If both are <= 12, default to DD/MM (common in India).
            if day_or_month_1 > 12 and day_or_month_2 <= 12:
                day, month = day_or_month_1, day_or_month_2
            elif day_or_month_2 > 12 and day_or_month_1 <= 12:
                month, day = day_or_month_1, day_or_month_2
            else:
                day, month = day_or_month_1, day_or_month_2
            return date(year, month, day)

    # dot formats like DD.MM.YYYY or YYYY.MM.DD
    if "." in s:
        parts = s.split(".")
        if len(parts) == 3:
            p1, p2, p3 = parts
            if len(p1) == 4:  # YYYY.MM.DD
                year = int(p1)
                month = int(p2)
                day = int(p3)
                return date(year, month, day)
            if len(p3) == 2:  # DD.MM.YY
                # Assume YY -> 19xx/20xx using same mapping.
                year2 = int(p3)
                year = 2000 + year2 if year2 <= 68 else 1900 + year2
            else:
                year = int(p3)
            day = int(p1)
            month = int(p2)
            return date(year, month, day)

    raise ValueError(f"Invalid date format '{raw_date}'. Use YYYY-MM-DD.")


def _parse_amount(raw_amount: str) -> float:
    s = (raw_amount or "").strip()
    if not s:
        raise ValueError("amount is required.")
    # Be forgiving about common formatting artifacts.
    s = s.replace(",", "").replace("₹", "")
    return float(s)


def _duplicate_key(
    *,
    bank: str,
    transaction_date: date,
    amount: float,
    is_debit: bool,
) -> tuple:
    # Description is intentionally excluded — manual entries often differ.
    return (
        (bank or "").strip(),
        transaction_date.isoformat(),
        round(float(amount), 2),
        bool(is_debit),
    )


async def _load_existing_duplicate_keys(
    *,
    user_id: uuid.UUID,
    start_date: date,
    end_date: date,
    banks: set[str],
) -> set[tuple]:
    if start_date > end_date:
        return set()
    stmt = (
        select(
            Transaction.bank,
            Transaction.transaction_date,
            Transaction.amount,
            Transaction.is_debit,
        )
        .where(Transaction.user_id == user_id)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date <= end_date)
    )
    if banks:
        stmt = stmt.where(Transaction.bank.in_(sorted(banks)))
    async with get_readonly_connection() as session:
        result = await session.execute(stmt)
        rows = result.all()
    keys: set[tuple] = set()
    for bank, txn_date, amount, is_debit in rows:
        keys.add(
            _duplicate_key(
                bank=bank or "",
                transaction_date=txn_date,
                amount=float(amount),
                is_debit=bool(is_debit),
            )
        )
    return keys


def _preview_row_duplicate_key(row: ImportPreviewRow) -> Optional[tuple]:
    try:
        txn_date = _parse_transaction_date(row.transaction_date)
        amount = _parse_amount(row.amount)
        is_debit = _parse_is_debit(row.is_debit if row.is_debit else "true")
    except ValueError:
        return None
    if amount <= 0:
        return None
    return _duplicate_key(
        bank=row.bank,
        transaction_date=txn_date,
        amount=amount,
        is_debit=is_debit,
    )


async def _annotate_import_duplicates(
    rows: list[ImportPreviewRow],
    *,
    user_id: uuid.UUID,
) -> list[ImportPreviewRow]:
    """Flag rows that match an existing transaction or an earlier row in this file."""
    keyed: list[tuple[ImportPreviewRow, Optional[tuple]]] = [
        (row, _preview_row_duplicate_key(row)) for row in rows
    ]
    dates = [
        date.fromisoformat(key[1]) for _, key in keyed if key is not None
    ]
    if not dates:
        return rows

    banks = {key[0] for _, key in keyed if key is not None}
    existing = await _load_existing_duplicate_keys(
        user_id=user_id,
        start_date=min(dates),
        end_date=max(dates),
        banks=banks,
    )

    seen_in_file: dict[tuple, int] = {}
    annotated: list[ImportPreviewRow] = []
    for row, key in keyed:
        if key is None:
            annotated.append(row)
            continue

        message: Optional[str] = None
        if key in existing:
            message = (
                "Matches an existing transaction. Skipped unless you choose Import anyway."
            )
        elif key in seen_in_file:
            message = (
                f"Duplicate of row {seen_in_file[key]} in this file. "
                "Skipped unless you choose Import anyway."
            )
        else:
            seen_in_file[key] = row.source_row

        if not message:
            annotated.append(row)
            continue

        issues = [
            issue for issue in row.issues if issue.code != "duplicate"
        ]
        issues.append(
            ImportFieldIssue(
                field="duplicate",
                code="duplicate",
                message=message,
            )
        )
        annotated.append(
            row.model_copy(update={"is_duplicate": True, "issues": issues})
        )
    return annotated


async def export_transactions_csv(
    start_date: date,
    end_date: date,
    category: Optional[str],
    payment_method: Optional[str] = None,
    *,
    user_id: uuid.UUID,
    q: Optional[str] = None,
    is_debit: Optional[bool] = None,
    bank: Optional[str] = None,
) -> str:
    """Return CSV string for all transactions matching the given filters."""
    stmt = (
        select(
            Transaction.transaction_date,
            Transaction.category,
            Transaction.amount,
            Transaction.is_debit,
            Transaction.description,
            Transaction.payment_method,
            Transaction.bank,
        )
        .where(Transaction.user_id == user_id)
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date <= end_date)
        .order_by(Transaction.transaction_date.asc())
    )
    if category and category != "All":
        stmt = stmt.where(Transaction.category == category)
    if payment_method and payment_method != "All":
        stmt = stmt.where(Transaction.payment_method == payment_method)
    if bank and bank != "All":
        stmt = stmt.where(Transaction.bank == bank)
    if is_debit is not None:
        stmt = stmt.where(Transaction.is_debit == bool(is_debit))
    term = (q or "").strip()
    if term:
        stmt = stmt.where(transaction_text_search(term))
    async with get_readonly_connection() as session:
        rows = (await session.execute(stmt)).mappings().all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                "transaction_date": row.get("transaction_date", ""),
                "category": row.get("category", ""),
                "amount": row.get("amount", ""),
                "is_debit": str(bool(row.get("is_debit", True))).lower(),
                "description": row.get("description") or "",
                "payment_method": row.get("payment_method") or "",
                "bank": row.get("bank") or "",
            }
        )
    return output.getvalue()


def transactions_csv_template() -> str:
    """Return CSV string with correct headers and example rows for import."""
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
    writer.writeheader()
    example_rows = [
        {
            "transaction_date": "2026-03-01",
            "category": "Grocery",
            "amount": "1250.50",
            "is_debit": "true",
            "description": "Weekly groceries",
            "payment_method": "UPI",
            "bank": "SBI",
        },
        {
            "transaction_date": "2026-03-02",
            "category": "Dining",
            "amount": "450",
            "is_debit": "true",
            "description": "Lunch",
            "payment_method": "Card",
            "bank": "Kotak",
        },
        {
            "transaction_date": "2026-03-03",
            "category": "Transportation",
            "amount": "320",
            "is_debit": "false",
            "description": "",
            "payment_method": "Cash",
            "bank": "Slice",
        },
    ]
    for row in example_rows:
        writer.writerow(row)
    return output.getvalue()


async def _parse_csv_rows_for_preview(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
) -> tuple[list[ImportPreviewRow], list[str], list[str]]:
    """
    Parse CSV into preview rows with per-field issues.

    Returns (preview_rows, file_errors, category_names_seen).
    Category column is optional; blank category blocks ready until review.
    """
    try:
        text_data = content.decode("utf-8-sig")
    except UnicodeDecodeError:
        return [], ["CSV file must be UTF-8 encoded."], []

    reader = csv.DictReader(io.StringIO(text_data))

    if reader.fieldnames is None:
        return [], ["CSV file has no header row."], []

    header_map = {name.lower(): name for name in reader.fieldnames}
    required_cols = ["transaction_date", "amount"]
    missing = [c for c in required_cols if c not in header_map]
    if missing:
        return (
            [],
            [
                "Missing required column(s): "
                + ", ".join(missing)
                + ". Expected at least: transaction_date, amount."
            ],
            [],
        )

    known = await known_category_map(user_id)
    preview_rows: list[ImportPreviewRow] = []
    category_names: list[str] = []

    for idx, row in enumerate(reader, start=2):
        raw_date = (row.get(header_map["transaction_date"]) or "").strip()
        raw_category = (
            (row.get(header_map["category"]) or "").strip()
            if "category" in header_map
            else ""
        )
        raw_amount = (row.get(header_map["amount"]) or "").strip()
        raw_description = (
            (row.get(header_map.get("description", "")) or "").strip()
            if "description" in header_map
            else ""
        )
        raw_is_debit = (
            (row.get(header_map["is_debit"]) or "").strip()
            if "is_debit" in header_map
            else "true"
        )
        raw_payment_method = (
            (row.get(header_map["payment_method"]) or "").strip()
            if "payment_method" in header_map
            else ""
        )
        raw_bank = (
            (row.get(header_map["bank"]) or "").strip()
            if "bank" in header_map
            else ""
        )
        row_bank = raw_bank or (bank or "").strip()

        preview_row = _build_import_preview_row(
            source_row=idx,
            raw_date=raw_date,
            raw_category=raw_category,
            raw_amount=raw_amount,
            raw_is_debit=raw_is_debit if "is_debit" in header_map else "true",
            raw_description=raw_description,
            raw_payment_method=raw_payment_method,
            bank=row_bank,
            known=known,
            has_is_debit_column="is_debit" in header_map,
        )
        if preview_row.category.strip():
            category_names.append(normalize_category_name(preview_row.category))
        preview_rows.append(preview_row)

    return preview_rows, [], category_names


def _build_import_preview_row(
    *,
    source_row: int,
    raw_date: str,
    raw_category: str,
    raw_amount: str,
    raw_is_debit: str,
    raw_description: str,
    raw_payment_method: str,
    bank: str,
    known: dict[str, str],
    has_is_debit_column: bool = True,
) -> ImportPreviewRow:
    issues: list[ImportFieldIssue] = []
    parsed_date: date | None = None
    parsed_amount: float | None = None
    parsed_is_debit = True
    parsed_payment_method: str | None = None
    normalized_category = ""

    if not raw_date:
        issues.append(
            ImportFieldIssue(
                field="transaction_date",
                code="required",
                message="Transaction date is required.",
            )
        )
    else:
        try:
            parsed_date = _parse_transaction_date(raw_date)
            if parsed_date > date.today():
                issues.append(
                    ImportFieldIssue(
                        field="transaction_date",
                        code="invalid_value",
                        message="Transaction date cannot be in the future.",
                    )
                )
        except ValueError as exc:
            issues.append(
                ImportFieldIssue(
                    field="transaction_date",
                    code="invalid_format",
                    message=str(exc),
                )
            )

    if not raw_category:
        issues.append(
            ImportFieldIssue(
                field="category",
                code="required",
                message="Category is required.",
            )
        )
    else:
        try:
            normalized_category = normalize_category_name(raw_category)
            if not normalized_category:
                issues.append(
                    ImportFieldIssue(
                        field="category",
                        code="required",
                        message="Category is required.",
                    )
                )
            elif len(normalized_category) > 40:
                issues.append(
                    ImportFieldIssue(
                        field="category",
                        code="invalid_value",
                        message="Category name must be at most 40 characters.",
                    )
                )
        except ValueError as exc:
            issues.append(
                ImportFieldIssue(
                    field="category",
                    code="invalid_value",
                    message=str(exc),
                )
            )

    if not raw_amount:
        issues.append(
            ImportFieldIssue(
                field="amount",
                code="required",
                message="Amount is required.",
            )
        )
    else:
        try:
            parsed_amount = _parse_amount(raw_amount)
            if parsed_amount <= 0:
                issues.append(
                    ImportFieldIssue(
                        field="amount",
                        code="invalid_value",
                        message="Amount must be greater than 0.",
                    )
                )
        except ValueError:
            issues.append(
                ImportFieldIssue(
                    field="amount",
                    code="invalid_format",
                    message=f"Invalid amount '{raw_amount}'. Must be a number.",
                )
            )

    if has_is_debit_column:
        try:
            parsed_is_debit = _parse_is_debit(raw_is_debit)
        except ValueError as exc:
            issues.append(
                ImportFieldIssue(
                    field="is_debit",
                    code="invalid_format",
                    message=str(exc),
                )
            )
    else:
        try:
            parsed_is_debit = _parse_is_debit(raw_is_debit or "true")
        except ValueError as exc:
            issues.append(
                ImportFieldIssue(
                    field="is_debit",
                    code="invalid_format",
                    message=str(exc),
                )
            )

    if raw_payment_method:
        if raw_payment_method not in PAYMENT_METHODS:
            issues.append(
                ImportFieldIssue(
                    field="payment_method",
                    code="invalid_value",
                    message=(
                        "Invalid payment method. Must be one of: "
                        + ", ".join(PAYMENT_METHODS)
                    ),
                )
            )
        else:
            parsed_payment_method = raw_payment_method

    parsed_bank = ""
    if not (bank or "").strip():
        issues.append(
            ImportFieldIssue(
                field="bank",
                code="required",
                message="Bank is required.",
            )
        )
    else:
        try:
            parsed_bank = _normalize_bank(bank)
        except ValueError:
            issues.append(
                ImportFieldIssue(
                    field="bank",
                    code="invalid_value",
                    message=f"Invalid bank. Must be one of: {', '.join(BANKS)}",
                )
            )
            parsed_bank = (bank or "").strip()

    category_is_new = False
    if normalized_category and not any(issue.field == "category" for issue in issues):
        category_is_new = category_key(normalized_category) not in known
        if category_is_new:
            issues.append(
                ImportFieldIssue(
                    field="category",
                    code="unknown_category",
                    message=(
                        f'Category "{normalized_category}" is not in your list. '
                        "Map to an existing category or approve it as new."
                    ),
                )
            )

    blocking_codes = {"required", "invalid_format", "invalid_value"}
    has_blocking = any(issue.code in blocking_codes for issue in issues)
    is_ready = not has_blocking and not category_is_new

    if is_ready and parsed_date and parsed_amount is not None and parsed_bank:
        try:
            TransactionCreate(
                amount=parsed_amount,
                category=normalized_category,
                bank=parsed_bank,
                payment_method=parsed_payment_method,
                transaction_date=parsed_date,
                description=raw_description or None,
                is_debit=parsed_is_debit,
            )
        except ValidationError as exc:
            is_ready = False
            message = "; ".join(
                err.get("msg", "Invalid value") for err in exc.errors()
            )
            if not any(issue.message == message for issue in issues):
                issues.append(
                    ImportFieldIssue(
                        field="row",
                        code="invalid_value",
                        message=message,
                    )
                )

    return ImportPreviewRow(
        source_row=source_row,
        transaction_date=raw_date,
        category=raw_category,
        amount=raw_amount,
        is_debit=raw_is_debit if has_is_debit_column else (raw_is_debit or "true"),
        bank=parsed_bank or (bank or "").strip(),
        description=raw_description or None,
        payment_method=raw_payment_method or None,
        issues=issues,
        is_ready=is_ready,
        category_is_new=category_is_new,
    )


async def _preview_from_statement_rows(
    raw_rows: list,
    *,
    user_id: uuid.UUID,
    bank: str,
) -> tuple[list[ImportPreviewRow], list[str], list[str]]:
    known = await known_category_map(user_id)
    preview_rows = [
        _build_import_preview_row(
            source_row=row.source_row,
            raw_date=row.transaction_date,
            raw_category=getattr(row, "category", "") or "",
            raw_amount=row.amount,
            raw_is_debit=row.is_debit,
            raw_description=row.description,
            raw_payment_method="",
            bank=bank,
            known=known,
            has_is_debit_column=True,
        )
        for row in raw_rows
    ]
    return preview_rows, [], []


async def _parse_sbi_rows_for_preview(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
    password: Optional[str],
) -> tuple[list[ImportPreviewRow], list[str], list[str]]:
    try:
        raw_rows = extract_sbi_rows(content, password=password)
    except BankStatementPasswordError as exc:
        return [], [str(exc)], []
    except BankStatementParseError as exc:
        return [], [str(exc)], []
    return await _preview_from_statement_rows(
        raw_rows, user_id=user_id, bank=bank
    )


async def _parse_slice_pdf_rows_for_preview(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
    password: Optional[str],
) -> tuple[list[ImportPreviewRow], list[str], list[str]]:
    try:
        raw_rows = extract_slice_pdf_rows(content, password=password)
    except BankStatementPasswordError as exc:
        return [], [str(exc)], []
    except BankStatementParseError as exc:
        return [], [str(exc)], []
    return await _preview_from_statement_rows(
        raw_rows, user_id=user_id, bank=bank
    )


async def _parse_sbi_pdf_rows_for_preview(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
    password: Optional[str],
) -> tuple[list[ImportPreviewRow], list[str], list[str]]:
    try:
        raw_rows = extract_sbi_pdf_rows(content, password=password)
    except BankStatementPasswordError as exc:
        return [], [str(exc)], []
    except BankStatementParseError as exc:
        return [], [str(exc)], []
    return await _preview_from_statement_rows(
        raw_rows, user_id=user_id, bank=bank
    )


async def _parse_kotak_pdf_rows_for_preview(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
    password: Optional[str],
) -> tuple[list[ImportPreviewRow], list[str], list[str]]:
    try:
        raw_rows = extract_kotak_pdf_rows(content, password=password)
    except BankStatementPasswordError as exc:
        return [], [str(exc)], []
    except BankStatementParseError as exc:
        return [], [str(exc)], []
    return await _preview_from_statement_rows(
        raw_rows, user_id=user_id, bank=bank
    )


_OLE_CFB_MAGIC = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"
_PDF_MAGIC = b"%PDF"


def _detect_import_kind(filename: Optional[str], content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".pdf"):
        return "pdf"
    if name.endswith(".xlsx"):
        return "xlsx"
    if name.endswith(".csv"):
        return "csv"
    stripped = content.lstrip()
    if stripped.startswith(_PDF_MAGIC):
        return "pdf"
    # Encrypted Office wrappers use OLE CFB; plain .xlsx is a zip.
    if content.startswith(_OLE_CFB_MAGIC) or content.startswith(b"PK"):
        return "xlsx"
    return "csv"


async def _parse_csv_transaction_rows(
    content: bytes,
    *,
    bank: str,
) -> tuple[list[dict], list[str], list[str]]:
    """
    Parse CSV into validated row dicts (without DB category resolution).

    Returns (parsed_rows, errors, category_names_seen).
    parsed_rows use TransactionCreate-validated fields but category may not exist yet.
    """
    text_data = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text_data))

    if reader.fieldnames is None:
        return [], ["CSV file has no header row."], []

    header_map = {name.lower(): name for name in reader.fieldnames}
    required_cols = ["transaction_date", "category", "amount"]
    missing = [c for c in required_cols if c not in header_map]
    if missing:
        return (
            [],
            [
                "Missing required column(s): "
                + ", ".join(missing)
                + ". Expected at least: transaction_date, category, amount."
            ],
            [],
        )

    errors: list[str] = []
    rows: list[dict] = []
    category_names: list[str] = []

    for idx, row in enumerate(reader, start=2):
        try:
            raw_date = (row.get(header_map["transaction_date"]) or "").strip()
            raw_category = (row.get(header_map["category"]) or "").strip()
            raw_amount = (row.get(header_map["amount"]) or "").strip()
            raw_description = (
                row.get(header_map.get("description", ""))
                if "description" in header_map
                else None
            )
            raw_is_debit = (
                (row.get(header_map["is_debit"]) or "").strip()
                if "is_debit" in header_map
                else ""
            )
            raw_payment_method = (
                (row.get(header_map["payment_method"]) or "").strip()
                if "payment_method" in header_map
                else ""
            )
            raw_bank = (
                (row.get(header_map["bank"]) or "").strip()
                if "bank" in header_map
                else ""
            )
            row_bank = raw_bank or (bank or "").strip()

            if not raw_date or not raw_category or not raw_amount:
                raise ValueError(
                    "transaction_date, category, and amount are required."
                )

            parsed_date = _parse_transaction_date(raw_date)
            try:
                parsed_amount = _parse_amount(raw_amount)
            except ValueError:
                raise ValueError(
                    f"Invalid amount '{raw_amount}'. Must be a number."
                )
            if "is_debit" in header_map:
                parsed_is_debit = _parse_is_debit(raw_is_debit)
            else:
                parsed_is_debit = True

            pm = raw_payment_method if raw_payment_method else None

            tx = TransactionCreate(
                amount=parsed_amount,
                category=raw_category,
                bank=row_bank,
                payment_method=pm,
                transaction_date=parsed_date,
                description=raw_description,
                is_debit=parsed_is_debit,
            )
            category_names.append(tx.category)
            rows.append(
                {
                    "amount": float(tx.amount),
                    "is_debit": bool(tx.is_debit),
                    "category": tx.category,
                    "bank": tx.bank,
                    "payment_method": tx.payment_method.strip()
                    if tx.payment_method
                    else None,
                    "transaction_date": tx.transaction_date,
                    "description": tx.description,
                }
            )
        except Exception as e:
            errors.append(f"Row {idx}: {e}")

    return rows, errors, category_names


async def preview_transactions_import(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
    password: Optional[str] = None,
    filename: Optional[str] = None,
) -> ImportPreviewResponse:
    """
    Parse CSV or supported bank Excel without inserting.
    Return every row with field-level issues.
    """
    try:
        bank = _normalize_bank(bank)
    except ValueError as exc:
        return ImportPreviewResponse(
            rows=[],
            file_errors=[str(exc)],
            new_categories=[],
            valid_row_count=0,
            errors=[str(exc)],
        )

    kind = _detect_import_kind(filename, content)
    if kind == "xlsx":
        if bank != BANK_SBI:
            msg = (
                f"Excel statement import for {bank} is not supported yet. "
                "Use a CSV template, or choose SBI for SBI Excel statements."
            )
            return ImportPreviewResponse(
                rows=[],
                file_errors=[msg],
                new_categories=[],
                valid_row_count=0,
                errors=[msg],
            )
        preview_rows, file_errors, category_names = await _parse_sbi_rows_for_preview(
            content,
            user_id=user_id,
            bank=bank,
            password=password,
        )
    elif kind == "pdf":
        if bank == BANK_SLICE:
            preview_rows, file_errors, category_names = (
                await _parse_slice_pdf_rows_for_preview(
                    content,
                    user_id=user_id,
                    bank=bank,
                    password=password,
                )
            )
        elif bank == BANK_KOTAK:
            preview_rows, file_errors, category_names = (
                await _parse_kotak_pdf_rows_for_preview(
                    content,
                    user_id=user_id,
                    bank=bank,
                    password=password,
                )
            )
        elif bank == BANK_SBI:
            preview_rows, file_errors, category_names = (
                await _parse_sbi_pdf_rows_for_preview(
                    content,
                    user_id=user_id,
                    bank=bank,
                    password=password,
                )
            )
        else:
            msg = (
                f"PDF statement import for {bank} is not supported yet. "
                "Use a CSV template, or choose SBI/Kotak/Slice for their PDF statements."
            )
            return ImportPreviewResponse(
                rows=[],
                file_errors=[msg],
                new_categories=[],
                valid_row_count=0,
                errors=[msg],
            )
    else:
        preview_rows, file_errors, category_names = await _parse_csv_rows_for_preview(
            content,
            user_id=user_id,
            bank=bank,
        )

    if file_errors:
        return ImportPreviewResponse(
            rows=[],
            file_errors=file_errors,
            new_categories=[],
            valid_row_count=0,
            errors=file_errors,
        )

    new_categories = await list_missing_category_names(user_id, category_names)
    preview_rows = await _annotate_import_duplicates(
        preview_rows, user_id=user_id
    )
    valid_row_count = sum(
        1 for row in preview_rows if row.is_ready and not row.is_duplicate
    )
    duplicate_row_count = sum(1 for row in preview_rows if row.is_duplicate)
    row_errors = [
        f"Row {row.source_row}: {issue.message}"
        for row in preview_rows
        for issue in row.issues
        if issue.code not in {"unknown_category", "duplicate"}
    ]

    return ImportPreviewResponse(
        rows=preview_rows,
        file_errors=[],
        new_categories=new_categories,
        valid_row_count=valid_row_count,
        duplicate_row_count=duplicate_row_count,
        errors=row_errors,
    )


async def import_reviewed_transactions(
    payload: ReviewedImportRequest,
    *,
    user_id: uuid.UUID,
) -> ReviewedImportResponse:
    """
    Insert only the user-reviewed rows atomically.

    Duplicate rows (same bank/date/amount/debit as an existing transaction
    or an earlier row in this batch) are skipped unless ``force_duplicate``
    is set on that row. Description is ignored so manual wording differences
    still flag as duplicates.
    """
    approved_keys = {
        category_key(name) for name in payload.approved_new_categories
    }
    rows_to_insert: list[dict] = []
    row_category_keys = {category_key(row.category) for row in payload.rows}
    approved_names = [
        name
        for name in payload.approved_new_categories
        if category_key(name) in row_category_keys
    ]
    known = await known_category_map(user_id)
    errors = [
        (
            f'Row {row.source_row}: Unknown category "{row.category}". '
            "Create it from the dropdown or confirm import to add new categories."
        )
        for row in payload.rows
        if category_key(row.category) not in known
        and category_key(row.category) not in approved_keys
    ]
    if errors:
        return ReviewedImportResponse(
            inserted=0,
            created_categories=[],
            skipped_duplicates=0,
            errors=errors,
        )

    missing_approved = (
        await list_missing_category_names(user_id, approved_names)
        if approved_names
        else []
    )
    try:
        registered = await register_category_names(user_id, missing_approved)
    except ValueError as exc:
        return ReviewedImportResponse(
            inserted=0,
            created_categories=[],
            skipped_duplicates=0,
            errors=[str(exc)],
        )
    created_categories = [category.name for category in registered]
    errors = []

    dates = [row.transaction_date for row in payload.rows]
    banks = {row.bank for row in payload.rows}
    existing_keys = await _load_existing_duplicate_keys(
        user_id=user_id,
        start_date=min(dates),
        end_date=max(dates),
        banks=banks,
    )
    seen_in_batch: set[tuple] = set()
    skipped_duplicates = 0

    for row in payload.rows:
        try:
            canonical = await resolve_category_name(
                user_id,
                row.category,
                allow_new=False,
            )
        except ValueError as exc:
            errors.append(f"Row {row.source_row}: {exc}")
            continue

        key = _duplicate_key(
            bank=row.bank,
            transaction_date=row.transaction_date,
            amount=float(row.amount),
            is_debit=bool(row.is_debit),
        )
        is_duplicate = key in existing_keys or key in seen_in_batch
        if is_duplicate and not row.force_duplicate:
            skipped_duplicates += 1
            continue

        rows_to_insert.append(
            {
                "user_id": user_id,
                "amount": float(row.amount),
                "is_debit": bool(row.is_debit),
                "category": canonical,
                "bank": row.bank,
                "payment_method": row.payment_method,
                "transaction_date": row.transaction_date,
                "description": row.description,
            }
        )
        seen_in_batch.add(key)
        existing_keys.add(key)

    if errors:
        return ReviewedImportResponse(
            inserted=0,
            created_categories=[],
            skipped_duplicates=0,
            errors=errors,
        )

    inserted_count = 0
    if rows_to_insert:
        async with get_connection() as session:
            await session.execute(Transaction.__table__.insert(), rows_to_insert)
        inserted_count = len(rows_to_insert)

    return ReviewedImportResponse(
        inserted=inserted_count,
        created_categories=created_categories,
        skipped_duplicates=skipped_duplicates,
        errors=[],
    )


async def import_transactions_from_csv(
    content: bytes,
    *,
    user_id: uuid.UUID,
    bank: str,
    create_missing_categories: bool = False,
) -> tuple[int, list[str], list[str]]:
    """
    Parse CSV content and insert valid rows into the transactions table.

    Expected columns (case-insensitive):
    transaction_date (YYYY-MM-DD), category, amount, is_debit (optional but recommended),
    description (optional), payment_method (optional; omitted or empty leaves it unset),
    bank (optional; when present and non-blank, overrides the form-selected bank for that row).
    Returns (inserted_count, errors, created_categories).
    """
    try:
        bank = _normalize_bank(bank)
    except ValueError as exc:
        return 0, [str(exc)], []

    rows, errors, category_names = await _parse_csv_transaction_rows(content, bank=bank)
    if not rows and errors:
        return 0, errors, []

    created_categories: list[str] = []
    if create_missing_categories:
        missing_categories = await list_missing_category_names(
            user_id,
            category_names,
        )
        try:
            registered = await register_category_names(user_id, missing_categories)
        except ValueError as exc:
            return 0, [*errors, str(exc)], []
        created_categories = [category.name for category in registered]

    rows_to_insert: list[dict] = []
    for idx, row in enumerate(rows):
        try:
            canonical = await resolve_category_name(
                user_id,
                row["category"],
                allow_new=False,
            )
            rows_to_insert.append(
                {
                    "user_id": user_id,
                    "amount": row["amount"],
                    "is_debit": row["is_debit"],
                    "category": canonical,
                    "bank": row["bank"],
                    "payment_method": row["payment_method"],
                    "transaction_date": row["transaction_date"],
                    "description": row["description"],
                }
            )
        except Exception as e:
            errors.append(f"Row (parsed #{idx + 1}): {e}")

    inserted_count = 0
    if rows_to_insert:
        async with get_connection() as session:
            await session.execute(Transaction.__table__.insert(), rows_to_insert)
        inserted_count = len(rows_to_insert)

    if not create_missing_categories:
        created_categories = []

    return inserted_count, errors, created_categories


def _add_months(month_start: date, delta_months: int) -> date:
    """Return the first day of the month `delta_months` from `month_start` (also a month start)."""
    year = month_start.year
    month = month_start.month + delta_months
    while month > 12:
        month -= 12
        year += 1
    while month < 1:
        month += 12
        year -= 1
    return date(year, month, 1)


def _parse_focus_month(month: str | None) -> date:
    """Parse YYYY-MM into the first day of that month; default to the current month."""
    if month is None or not str(month).strip():
        return date.today().replace(day=1)
    raw = str(month).strip()
    try:
        year_s, month_s = raw.split("-", 1)
        year = int(year_s)
        mon = int(month_s)
        if mon < 1 or mon > 12:
            raise ValueError
        return date(year, mon, 1)
    except (TypeError, ValueError) as exc:
        raise ValueError("month must be YYYY-MM") from exc


def _dashboard_bounds(months: int, focus_month: date | None = None) -> dict[str, date]:
    month_now_start = focus_month or date.today().replace(day=1)
    return {
        "month_now_start": month_now_start,
        "month_next_start": _add_months(month_now_start, 1),
        "prev_month_start": _add_months(month_now_start, -1),
        "trend_start": _add_months(month_now_start, -(months - 1)),
    }


def _normalize_banks_filter(banks: list[str] | None) -> list[str] | None:
    """Return validated bank names to filter on, or None for all banks."""
    if not banks:
        return None
    normalized: list[str] = []
    seen: set[str] = set()
    for raw in banks:
        name = str(raw).strip()
        if not name or name in seen:
            continue
        if name not in BANKS:
            raise ValueError(f"Invalid bank. Must be one of: {', '.join(BANKS)}")
        seen.add(name)
        normalized.append(name)
    return normalized or None


def _dashboard_params(
    bounds: dict[str, date],
    user_id: uuid.UUID,
    *,
    banks: list[str] | None = None,
) -> dict[str, Any]:
    return {
        **bounds,
        "user_id": user_id,
        "filter_banks": banks is not None,
        "banks_csv": ",".join(banks) if banks else "",
        "investments_category": INVESTMENTS_CATEGORY,
        "self_transfer_category": SELF_TRANSFER_CATEGORY,
        "wallet_top_up_category": WALLET_TOP_UP_CATEGORY,
    }


def _parse_json_value(raw: Any, default: Any) -> Any:
    if raw is None:
        return default
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


_MONTH_LABELS = (
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
)


def _parse_month_start(value: Any) -> date | None:
    if value is None:
        return None
    if isinstance(value, date):
        return value
    if isinstance(value, str):
        return date.fromisoformat(value[:10])
    return None


def _build_trend_points(
    months: int,
    bounds: dict[str, date],
    trend_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    spend_by_month_start: dict[date, float] = {}
    for row in trend_rows:
        month_start = _parse_month_start(row.get("month_start"))
        if month_start is not None:
            spend_by_month_start[month_start] = float(row.get("spend") or 0)
    trend_start = bounds["trend_start"]
    month_now_start = bounds["month_now_start"]

    points: list[dict[str, Any]] = []
    for offset in range(months):
        month_start = _add_months(trend_start, offset)
        if month_start > month_now_start:
            break
        points.append(
            {
                "month_label": _MONTH_LABELS[month_start.month - 1],
                "spend": spend_by_month_start.get(month_start, 0.0),
            }
        )
    return points


_DASHBOARD_AGGREGATES_SQL = """
WITH current_month AS (
  SELECT t.*
  FROM transactions t
  WHERE t.user_id = :user_id
    AND t.transaction_date >= :month_now_start
    AND t.transaction_date < :month_next_start
    AND (NOT :filter_banks OR t.bank = ANY(string_to_array(:banks_csv, ',')))
),
spend_txns AS (
  SELECT cm.*
  FROM current_month cm
  WHERE cm.is_debit = TRUE
    AND cm.category NOT IN (
      :investments_category, :self_transfer_category, :wallet_top_up_category
    )
),
summary AS (
  SELECT
    COALESCE(SUM(CASE WHEN t.is_debit THEN -t.amount ELSE t.amount END), 0)::float8 AS portfolio_net,
    COALESCE(SUM(CASE
      WHEN t.is_debit = TRUE
       AND t.category NOT IN (
         :investments_category, :self_transfer_category, :wallet_top_up_category
       )
       AND t.transaction_date >= :month_now_start
       AND t.transaction_date < :month_next_start
      THEN t.amount ELSE 0 END), 0)::float8 AS current_month_spend,
    COALESCE(SUM(CASE
      WHEN t.is_debit = TRUE
       AND t.category NOT IN (
         :investments_category, :self_transfer_category, :wallet_top_up_category
       )
       AND t.transaction_date >= :prev_month_start
       AND t.transaction_date < :month_now_start
      THEN t.amount ELSE 0 END), 0)::float8 AS previous_month_spend
  FROM transactions t
  WHERE t.user_id = :user_id
    AND t.transaction_date < :month_next_start
    AND (NOT :filter_banks OR t.bank = ANY(string_to_array(:banks_csv, ',')))
),
trend_rows AS (
  SELECT
    date_trunc('month', t.transaction_date)::date AS month_start,
    COALESCE(SUM(t.amount), 0)::float8 AS spend
  FROM transactions t
  WHERE t.user_id = :user_id
    AND t.is_debit = TRUE
    AND t.category NOT IN (
      :investments_category, :self_transfer_category, :wallet_top_up_category
    )
    AND t.transaction_date >= :trend_start
    AND t.transaction_date < :month_next_start
    AND (NOT :filter_banks OR t.bank = ANY(string_to_array(:banks_csv, ',')))
  GROUP BY 1
),
highlights AS (
  SELECT
    COALESCE(SUM(CASE WHEN cm.is_debit = FALSE THEN cm.amount ELSE 0 END), 0)::float8 AS total_inflow,
    COALESCE(SUM(CASE WHEN cm.is_debit = TRUE THEN cm.amount ELSE 0 END), 0)::float8 AS total_outflow,
    COALESCE(SUM(CASE
      WHEN cm.is_debit = TRUE AND cm.category = :investments_category
      THEN cm.amount ELSE 0 END), 0)::float8 AS current_month_investments
  FROM current_month cm
),
top_category AS (
  SELECT st.category, COALESCE(SUM(st.amount), 0)::float8 AS spend
  FROM spend_txns st
  GROUP BY st.category
  ORDER BY spend DESC
  LIMIT 1
),
category_spend AS (
  SELECT st.category, COALESCE(SUM(st.amount), 0)::float8 AS spend
  FROM spend_txns st
  GROUP BY st.category
  HAVING COALESCE(SUM(st.amount), 0) > 0
  ORDER BY spend DESC
),
daily_agg AS (
  SELECT
    st.transaction_date AS day_date,
    COALESCE(SUM(st.amount), 0)::float8 AS spend
  FROM spend_txns st
  GROUP BY st.transaction_date
),
daily_series AS (
  SELECT generate_series(
    :month_now_start,
    :month_next_start - interval '1 day',
    interval '1 day'
  )::date AS day_date
),
daily_spend AS (
  SELECT COALESCE(SUM(st.amount), 0)::float8 AS total
  FROM spend_txns st
)
SELECT
  s.portfolio_net,
  s.current_month_spend,
  s.previous_month_spend,
  COALESCE(
    (SELECT json_agg(json_build_object('month_start', tr.month_start, 'spend', tr.spend)) FROM trend_rows tr),
    '[]'::json
  ) AS trend_rows,
  h.total_inflow,
  h.total_outflow,
  h.current_month_investments,
  (SELECT json_build_object('category', tc.category, 'spend', tc.spend) FROM top_category tc) AS top_category,
  COALESCE(
    (SELECT json_agg(json_build_object('category', cs.category, 'spend', cs.spend) ORDER BY cs.spend DESC)
     FROM category_spend cs),
    '[]'::json
  ) AS category_spend_rows,
  to_char(:month_now_start, 'Mon YYYY') AS month_label,
  (SELECT total FROM daily_spend) AS daily_total,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'day', EXTRACT(DAY FROM ds.day_date)::int,
          'spend', COALESCE(da.spend, 0)
        )
        ORDER BY ds.day_date
      )
      FROM daily_series ds
      LEFT JOIN daily_agg da ON da.day_date = ds.day_date
    ),
    '[]'::json
  ) AS daily_points
FROM summary s
CROSS JOIN highlights h
"""


async def _get_dashboard_aggregates(
    bounds: dict[str, date],
    months: int,
    *,
    user_id: uuid.UUID,
    banks: list[str] | None = None,
) -> dict:
    """Single-query dashboard aggregates (summary, trend, highlights, daily spend)."""
    async with get_readonly_connection() as session:
        result = await session.execute(
            text(_DASHBOARD_AGGREGATES_SQL),
            _dashboard_params(bounds, user_id, banks=banks),
        )
        row = result.mappings().first() or {}

    current = float(row.get("current_month_spend") or 0)
    previous = float(row.get("previous_month_spend") or 0)
    spend_delta_pct = None
    if previous > 0:
        spend_delta_pct = ((current - previous) / previous) * 100.0

    trend_rows = _parse_json_value(row.get("trend_rows"), [])
    if not isinstance(trend_rows, list):
        trend_rows = []

    top_category = _parse_json_value(
        row.get("top_category"),
        {"category": None, "spend": 0.0},
    )
    if not isinstance(top_category, dict):
        top_category = {"category": None, "spend": 0.0}

    category_spend_rows = _parse_json_value(row.get("category_spend_rows"), [])
    if not isinstance(category_spend_rows, list):
        category_spend_rows = []

    category_spend_items = [
        {
            "category": str(item.get("category") or ""),
            "spend": float(item.get("spend") or 0),
        }
        for item in category_spend_rows
        if isinstance(item, dict) and item.get("category")
    ]

    return {
        "summary": {
            "portfolio_net": float(row.get("portfolio_net") or 0),
            "current_month_spend": current,
            "previous_month_spend": previous,
            "spend_delta_pct": spend_delta_pct,
        },
        "trend_points": _build_trend_points(months, bounds, trend_rows),
        "highlights": {
            "top_category": top_category,
            "total_inflow": float(row.get("total_inflow") or 0),
            "total_outflow": float(row.get("total_outflow") or 0),
            "current_month_investments": float(row.get("current_month_investments") or 0),
        },
        "daily_spend": {
            "month_label": row.get("month_label") or "",
            "total": float(row.get("daily_total") or 0),
            "points": _parse_json_value(row.get("daily_points"), []),
        },
        "category_spend": {"items": category_spend_items},
    }


async def _get_dashboard_recent(
    recent_limit: int,
    bounds: dict[str, date],
    *,
    user_id: uuid.UUID,
    banks: list[str] | None = None,
) -> list:
    sql = """
        SELECT
          id::text,
          transaction_date,
          category,
          bank,
          payment_method,
          amount::float8 AS amount,
          is_debit,
          description
        FROM transactions
        WHERE user_id = :user_id
          AND transaction_date >= :month_now_start
          AND transaction_date < :month_next_start
          AND (NOT :filter_banks OR bank = ANY(string_to_array(:banks_csv, ',')))
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT :recent_limit
    """
    async with get_readonly_connection() as session:
        result = await session.execute(
            text(sql),
            {
                "recent_limit": recent_limit,
                "user_id": user_id,
                "month_now_start": bounds["month_now_start"],
                "month_next_start": bounds["month_next_start"],
                "filter_banks": banks is not None,
                "banks_csv": ",".join(banks) if banks else "",
            },
        )
        rows = result.mappings().all()

    return [
        {
            "id": row["id"],
            "transaction_date": row["transaction_date"],
            "category": row["category"],
            "bank": row["bank"],
            "payment_method": row["payment_method"],
            "amount": float(row["amount"] or 0),
            "is_debit": row["is_debit"],
            "description": row["description"],
        }
        for row in rows
    ]


async def _get_active_banks(*, user_id: uuid.UUID) -> list[str]:
    """Banks that appear on the user's transactions, in product order."""
    sql = """
        SELECT DISTINCT bank
        FROM transactions
        WHERE user_id = :user_id
          AND bank IS NOT NULL
          AND btrim(bank) <> ''
    """
    async with get_readonly_connection() as session:
        result = await session.execute(text(sql), {"user_id": user_id})
        found = {str(row[0]) for row in result.fetchall() if row[0]}
    return [name for name in BANKS if name in found]


async def get_dashboard_overview(
    months: int = 12,
    recent_limit: int = 5,
    *,
    user_id: uuid.UUID,
    month: str | None = None,
    banks: list[str] | None = None,
) -> dict:
    """Return dashboard data via one aggregate query and one recent-transactions query."""
    months = max(1, min(int(months), 24))
    recent_limit = max(1, min(int(recent_limit), 20))
    focus_month = _parse_focus_month(month)
    bank_filter = _normalize_banks_filter(banks)
    bounds = _dashboard_bounds(months, focus_month)

    aggregates, recent_items, active_banks = await asyncio.gather(
        _get_dashboard_aggregates(bounds, months, user_id=user_id, banks=bank_filter),
        _get_dashboard_recent(recent_limit, bounds, user_id=user_id, banks=bank_filter),
        _get_active_banks(user_id=user_id),
    )

    return {
        "summary": aggregates["summary"],
        "trend": {"months": months, "points": aggregates["trend_points"]},
        "recent": {"items": recent_items},
        "highlights": aggregates["highlights"],
        "daily_spend": aggregates["daily_spend"],
        "category_spend": aggregates["category_spend"],
        "active_banks": active_banks,
    }
