"""Kotak savings PDF statement row extraction for bulk import preview."""

from __future__ import annotations

import re
from decimal import Decimal
from typing import Optional

from tracker.bank_import.errors import BankStatementParseError
from tracker.bank_import.pdf_common import (
    StatementRawRow,
    extract_pdf_text_pages,
    find_money_amounts,
    format_amount,
    infer_is_debit,
    parse_mon_date,
)

_TXN_START = re.compile(
    r"^(\d+)\s+(\d{1,2}\s+[A-Za-z]{3}\s+\d{4})\b\s*(.*)$"
)
_OPENING = re.compile(r"Opening Balance", re.IGNORECASE)
_END_MARKERS = (
    "end of statement",
    "statement generated on",
)
_PAGE_CHROME = re.compile(
    r"^(Savings Account Transactions|#\s*Date\s+Description|Account Statement)",
    re.IGNORECASE,
)


def _is_end_marker(line: str) -> bool:
    lower = line.lower()
    return any(marker in lower for marker in _END_MARKERS)


def _parse_opening_balance(lines: list[str]) -> Optional[Decimal]:
    for line in lines:
        if not _OPENING.search(line):
            continue
        amounts = find_money_amounts(line)
        if amounts:
            return amounts[-1]
    return None


def _strip_trailing_amounts(text: str, count: int = 2) -> str:
    rest = text.strip()
    for _ in range(count):
        rest = re.sub(
            r"(?:₹|Rs\.?\s*|INR\s*)?[\d,]+\.\d{2}\s*$",
            "",
            rest,
            flags=re.IGNORECASE,
        ).strip()
    return rest


def parse_kotak_statement_text(text: str) -> list[StatementRawRow]:
    """Parse Kotak statement plain text into raw import rows."""
    raw_lines = [ln.rstrip() for ln in (text or "").splitlines()]
    lines = [ln.strip() for ln in raw_lines if ln.strip()]

    opening = _parse_opening_balance(lines)
    blocks: list[tuple[int, str, list[str]]] = []
    current: Optional[tuple[int, str, list[str]]] = None

    for line in lines:
        if _is_end_marker(line):
            # Page footers ("Statement Generated…") should not end parsing mid-statement;
            # only hard-stop on End of Statement. Soft-skip generated footer lines.
            if "end of statement" in line.lower():
                break
            continue
        if _PAGE_CHROME.match(line):
            continue
        if _OPENING.search(line):
            continue

        start = _TXN_START.match(line)
        if start:
            if current is not None:
                blocks.append(current)
            serial = int(start.group(1))
            date_text = start.group(2)
            rest = start.group(3) or ""
            current = (serial, date_text, [rest] if rest else [])
            continue

        if current is not None:
            current[2].append(line)

    if current is not None:
        blocks.append(current)

    if not blocks:
        raise BankStatementParseError(
            "Could not find Kotak transactions "
            "(expected numbered rows under Withdrawal/Deposit/Balance)."
        )

    rows: list[StatementRawRow] = []
    prev_balance = opening

    for serial, date_text, parts in blocks:
        iso_date = parse_mon_date(date_text)
        if not iso_date:
            continue

        blob = " ".join(p for p in parts if p).strip()
        blob = re.sub(r"\s+", " ", blob)
        amounts = find_money_amounts(blob)
        if len(amounts) < 2:
            continue

        amount, balance = amounts[-2], amounts[-1]
        description = _strip_trailing_amounts(blob, 2)
        description = re.sub(r"\s+", " ", description).strip()

        if prev_balance is None:
            prev_balance = balance - amount

        try:
            is_debit = infer_is_debit(prev_balance, amount, balance)
        except ValueError:
            continue

        rows.append(
            StatementRawRow(
                source_row=serial,
                transaction_date=iso_date,
                description=description,
                amount=format_amount(amount),
                is_debit="true" if is_debit else "false",
            )
        )
        prev_balance = balance

    if not rows:
        raise BankStatementParseError("No transactions found in the Kotak statement.")

    return rows


def extract_kotak_pdf_rows(
    content: bytes,
    password: Optional[str] = None,
) -> list[StatementRawRow]:
    """Decrypt (if needed) and extract transaction rows from a Kotak PDF statement."""
    pages = extract_pdf_text_pages(content, password)
    return parse_kotak_statement_text("\n".join(pages))
