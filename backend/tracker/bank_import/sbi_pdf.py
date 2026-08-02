"""SBI savings PDF statement row extraction for bulk import preview."""

from __future__ import annotations

import re
from datetime import date
from typing import Optional

from tracker.bank_import.errors import BankStatementParseError
from tracker.bank_import.pdf_common import (
    StatementRawRow,
    extract_pdf_text_pages,
    format_amount,
    parse_money,
)

# Txn date + value date at the start of a transaction block.
_TXN_START = re.compile(
    r"^(\d{2}/\d{2}/\d{4})\s+(\d{2}/\d{2}/\d{4})\b\s*(.*)$"
)
# Debit column filled: "- 1,500.00 - 1,78,167.47"
_DEBIT_LINE = re.compile(
    r"^-\s*([\d,]+\.\d{2})\s+-\s+([\d,]+\.\d{2})\s*$"
)
# Credit column filled: "- - 30,000.00 2,08,167.47"
_CREDIT_LINE = re.compile(
    r"^-\s*-\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"
)
# Same-line amount trailing the description (e.g. INTEREST CREDIT - - 1,279.00 …)
_TRAILING_DEBIT = re.compile(
    r"^(.*?)\s+-\s*([\d,]+\.\d{2})\s+-\s+([\d,]+\.\d{2})\s*$"
)
_TRAILING_CREDIT = re.compile(
    r"^(.*?)\s+-\s*-\s*([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$"
)

_STOP_MARKERS = (
    "statement summary",
    "brought forward",
    "please do not share",
)
_PAGE_CHROME = (
    "page no.",
    "balance",
    "statement of account",
    "state bank of india",
)


def _parse_dmy(text: str) -> Optional[str]:
    match = re.match(r"^(\d{2})/(\d{2})/(\d{4})$", (text or "").strip())
    if not match:
        return None
    day, month, year = (int(match.group(1)), int(match.group(2)), int(match.group(3)))
    try:
        return date(year, month, day).isoformat()
    except ValueError:
        return None


def _is_stop(line: str) -> bool:
    lower = line.lower()
    return any(marker in lower for marker in _STOP_MARKERS)


def _is_chrome(line: str) -> bool:
    lower = line.lower().strip()
    if lower in {"balance"}:
        return True
    if re.fullmatch(r"\d*page no\.?", lower):
        return True
    return False


def _default_category(description: str) -> str:
    lower = description.lower()
    if "interest credit" in lower:
        return "Other Income"
    return ""


def _parse_amount_line(line: str) -> Optional[tuple[str, bool, str]]:
    """
    Return (description_fragment, is_debit, amount) if ``line`` ends with
    Debit/Credit + Balance columns, else None.
    """
    debit = _DEBIT_LINE.match(line)
    if debit:
        return "", True, format_amount(parse_money(debit.group(1)))

    credit = _CREDIT_LINE.match(line)
    if credit:
        return "", False, format_amount(parse_money(credit.group(1)))

    trailing_debit = _TRAILING_DEBIT.match(line)
    if trailing_debit:
        return (
            trailing_debit.group(1).strip(),
            True,
            format_amount(parse_money(trailing_debit.group(2))),
        )

    trailing_credit = _TRAILING_CREDIT.match(line)
    if trailing_credit:
        return (
            trailing_credit.group(1).strip(),
            False,
            format_amount(parse_money(trailing_credit.group(2))),
        )

    return None


def parse_sbi_pdf_statement_text(text: str) -> list[StatementRawRow]:
    """Parse SBI email/PDF statement plain text into raw import rows."""
    lines = [ln.strip() for ln in (text or "").splitlines() if ln.strip()]

    # Skip account-summary preamble; txn table follows the first Balance header
    # after STATEMENT OF ACCOUNT, but starting at the first txn-date line is enough.
    start_idx = 0
    for idx, line in enumerate(lines):
        if _TXN_START.match(line):
            start_idx = idx
            break
    else:
        raise BankStatementParseError(
            "Could not find SBI PDF transactions (expected DD/MM/YYYY date rows)."
        )

    rows: list[StatementRawRow] = []
    current_date: Optional[str] = None
    current_parts: list[str] = []
    source_row = 0

    def flush_incomplete() -> None:
        nonlocal current_date, current_parts
        current_date = None
        current_parts = []

    def emit(iso_date: str, description: str, amount: str, is_debit: bool) -> None:
        nonlocal source_row
        description = re.sub(r"\s+", " ", description).strip()
        if not description or not amount:
            return
        source_row += 1
        rows.append(
            StatementRawRow(
                source_row=source_row,
                transaction_date=iso_date,
                description=description,
                amount=amount,
                is_debit="true" if is_debit else "false",
                category=_default_category(description),
            )
        )

    for line in lines[start_idx:]:
        if _is_stop(line):
            break
        if _is_chrome(line):
            continue

        start = _TXN_START.match(line)
        if start:
            # Previous block without a money line is dropped.
            flush_incomplete()
            iso_date = _parse_dmy(start.group(1))
            if not iso_date:
                continue
            current_date = iso_date
            rest = (start.group(3) or "").strip()
            if rest:
                parsed = _parse_amount_line(rest)
                if parsed is not None:
                    frag, is_debit, amount = parsed
                    emit(iso_date, frag, amount, is_debit)
                    flush_incomplete()
                else:
                    current_parts = [rest]
            else:
                current_parts = []
            continue

        if current_date is None:
            continue

        parsed = _parse_amount_line(line)
        if parsed is not None:
            frag, is_debit, amount = parsed
            parts = current_parts + ([frag] if frag else [])
            emit(current_date, " ".join(parts), amount, is_debit)
            flush_incomplete()
            continue

        current_parts.append(line)

    if not rows:
        raise BankStatementParseError("No transactions found in the SBI PDF statement.")

    return rows


def extract_sbi_pdf_rows(
    content: bytes,
    password: Optional[str] = None,
) -> list[StatementRawRow]:
    """Decrypt (if needed) and extract transaction rows from an SBI PDF statement."""
    pages = extract_pdf_text_pages(content, password)
    return parse_sbi_pdf_statement_text("\n".join(pages))
