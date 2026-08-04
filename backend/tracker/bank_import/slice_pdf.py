"""Slice savings PDF statement row extraction for bulk import preview."""

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

_DATE_START = re.compile(r"^(\d{1,2}\s+[A-Za-z]{3}\s+'\d{2})\b")
_TXN_HEADER = re.compile(r"DATE\s+DETAILS.*AMOUNT\s+BALANCE", re.IGNORECASE)
_FOOTER_MARKERS = (
    "need help?",
    "generated on",
    "slice small finance bank",
)


def _is_footer(line: str) -> bool:
    lower = line.lower()
    return any(marker in lower for marker in _FOOTER_MARKERS)


def _parse_opening_balance(lines: list[str]) -> Optional[Decimal]:
    for idx, line in enumerate(lines):
        if "opening balance" not in line.lower():
            continue
        # Same line or following lines may hold the summary amounts.
        blob = " ".join(lines[idx : idx + 4])
        amounts = find_money_amounts(blob)
        if amounts:
            return amounts[0]
    return None


def parse_slice_statement_text(text: str) -> list[StatementRawRow]:
    """Parse Slice statement plain text into raw import rows."""
    lines = [ln.strip() for ln in (text or "").splitlines()]
    lines = [ln for ln in lines if ln]

    header_idx = None
    for idx, line in enumerate(lines):
        if _TXN_HEADER.search(line) or (
            "DATE" in line.upper()
            and "DETAILS" in line.upper()
            and "BALANCE" in line.upper()
        ):
            header_idx = idx
            break

    if header_idx is None:
        raise BankStatementParseError(
            "Could not find Slice statement headers (DATE, DETAILS, AMOUNT, BALANCE)."
        )

    opening = _parse_opening_balance(lines[: header_idx + 1])
    rows: list[StatementRawRow] = []
    prev_balance = opening
    source_row = 0

    for line in lines[header_idx + 1 :]:
        if _is_footer(line):
            break
        date_match = _DATE_START.match(line)
        if not date_match:
            continue

        iso_date = parse_mon_date(date_match.group(1))
        if not iso_date:
            continue

        amounts = find_money_amounts(line)
        if len(amounts) < 2:
            continue

        amount, balance = amounts[-2], amounts[-1]
        # Description is between date and the trailing amount/balance tokens.
        rest = line[date_match.end() :].strip()
        # Strip trailing money tokens (with optional currency) from description.
        rest = re.sub(
            r"(?:₹|Rs\.?\s*|INR\s*)?[\d,]+\.\d{2}\s*$",
            "",
            rest,
            flags=re.IGNORECASE,
        ).strip()
        rest = re.sub(
            r"(?:₹|Rs\.?\s*|INR\s*)?[\d,]+\.\d{2}\s*$",
            "",
            rest,
            flags=re.IGNORECASE,
        ).strip()
        # Drop trailing ref number if present as a bare digit token.
        rest = re.sub(r"\s+\d{6,}\s*$", "", rest).strip()
        description = re.sub(r"\s+", " ", rest).strip()

        if prev_balance is None:
            # Infer prior balance assuming this amount moved into the new balance.
            # Prefer credit then debit when ambiguous — opening should usually exist.
            prev_balance = balance - amount

        try:
            is_debit = infer_is_debit(prev_balance, amount, balance)
        except ValueError:
            # Skip mismatched rows rather than aborting the whole statement.
            continue

        source_row += 1
        category = (
            "Other Income"
            if "interest cr." in description.lower()
            else ""
        )
        rows.append(
            StatementRawRow(
                source_row=source_row,
                transaction_date=iso_date,
                description=description,
                amount=format_amount(amount),
                is_debit="true" if is_debit else "false",
                category=category,
            )
        )
        prev_balance = balance

    if not rows:
        raise BankStatementParseError("No transactions found in the Slice statement.")

    return rows


def extract_slice_pdf_rows(
    content: bytes,
    password: Optional[str] = None,
) -> list[StatementRawRow]:
    """Decrypt (if needed) and extract transaction rows from a Slice PDF statement."""
    pages = extract_pdf_text_pages(content, password)
    return parse_slice_statement_text("\n".join(pages))
