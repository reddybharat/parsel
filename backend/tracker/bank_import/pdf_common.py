"""Shared PDF decrypt + text extraction helpers for bank statement import."""

from __future__ import annotations

import io
import re
from dataclasses import dataclass
from datetime import date
from decimal import Decimal, InvalidOperation
from typing import Optional

from pypdf import PdfReader
from pypdf.errors import FileNotDecryptedError, PdfReadError

from tracker.bank_import.errors import (
    BankStatementParseError,
    BankStatementPasswordError,
)

PDF_MAGIC = b"%PDF"

_MONEY_RE = re.compile(
    r"(?:₹|Rs\.?\s*|INR\s*)?([\d,]+\.\d{2})",
    re.IGNORECASE,
)

_MONTHS = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}


@dataclass
class StatementRawRow:
    source_row: int
    transaction_date: str
    description: str
    amount: str
    is_debit: str
    category: str = ""


def is_pdf_bytes(content: bytes) -> bool:
    return content.lstrip().startswith(PDF_MAGIC)


def extract_pdf_text_pages(
    content: bytes,
    password: Optional[str] = None,
) -> list[str]:
    """
    Decrypt (if needed) and return plain text per page.

    Raises BankStatementPasswordError / BankStatementParseError.
    """
    if not is_pdf_bytes(content):
        raise BankStatementParseError("File is not a PDF statement.")

    try:
        reader = PdfReader(io.BytesIO(content))
    except PdfReadError as exc:
        raise BankStatementParseError(
            "Could not open PDF. Ensure it is a valid bank statement."
        ) from exc

    if reader.is_encrypted:
        if not (password or "").strip():
            raise BankStatementPasswordError("Password required to open this file.")
        try:
            result = reader.decrypt(password.strip())
        except Exception as exc:
            raise BankStatementPasswordError("Incorrect password.") from exc
        if result == 0:
            raise BankStatementPasswordError("Incorrect password.")

    try:
        pages: list[str] = []
        for page in reader.pages:
            try:
                text = page.extract_text() or ""
            except FileNotDecryptedError as exc:
                raise BankStatementPasswordError("Incorrect password.") from exc
            pages.append(text)
    except BankStatementPasswordError:
        raise
    except Exception as exc:
        raise BankStatementParseError(
            "Could not read PDF text. Scanned image PDFs are not supported."
        ) from exc

    if not any(p.strip() for p in pages):
        raise BankStatementParseError(
            "No extractable text in PDF. Scanned image PDFs are not supported."
        )

    return pages


def parse_money(text: str) -> Decimal:
    """Parse Indian-formatted money (optional currency prefix) to Decimal."""
    cleaned = (text or "").strip()
    if not cleaned:
        raise ValueError("Empty amount")
    cleaned = cleaned.replace("₹", "").replace(",", "")
    cleaned = re.sub(r"(?i)^(rs\.?|inr)\s*", "", cleaned).strip()
    try:
        return Decimal(cleaned)
    except InvalidOperation as exc:
        raise ValueError(f"Invalid amount '{text}'") from exc


def format_amount(value: Decimal) -> str:
    quantized = value.quantize(Decimal("0.01"))
    return f"{quantized:.2f}"


def find_money_amounts(text: str) -> list[Decimal]:
    """Return all money-like numbers found in text (order preserved)."""
    amounts: list[Decimal] = []
    for match in _MONEY_RE.finditer(text or ""):
        try:
            amounts.append(parse_money(match.group(1)))
        except ValueError:
            continue
    return amounts


def parse_mon_date(text: str) -> Optional[str]:
    """
    Parse dates like ``19 Jul '26`` or ``02 Jul 2026`` to ISO YYYY-MM-DD.
    """
    text = (text or "").strip()
    match = re.match(
        r"^(\d{1,2})\s+([A-Za-z]{3})\s+'?(\d{2}|\d{4})$",
        text,
    )
    if not match:
        return None
    day = int(match.group(1))
    month = _MONTHS.get(match.group(2).lower()[:3])
    if not month:
        return None
    year = int(match.group(3))
    if year < 100:
        year = 2000 + year if year <= 68 else 1900 + year
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def infer_is_debit(
    prev_balance: Decimal,
    amount: Decimal,
    new_balance: Decimal,
    *,
    tolerance: Decimal = Decimal("0.01"),
) -> bool:
    """
    Infer debit vs credit from balance movement.

    Raises ValueError when the balance change does not match the amount.
    """
    delta = new_balance - prev_balance
    if abs(delta + amount) <= tolerance:
        return True
    if abs(delta - amount) <= tolerance:
        return False
    raise ValueError(
        f"Balance change {delta} does not match amount {amount} "
        f"(prev={prev_balance}, new={new_balance})"
    )
