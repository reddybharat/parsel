"""
CSV export, template, and import for transactions.
Uses tracker.utils.db and tracker.schemas; no UI dependencies.
"""

import csv
import io
from datetime import date, datetime
from typing import Optional

from common.database import get_connection
from tracker.utils.db import execute_query
from tracker.schemas import TransactionCreate

# CSV column names (used for export, template, and import)
CSV_FIELDS = ["transaction_date", "category", "amount", "description"]


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


def export_transactions_csv(
    start_date: date, end_date: date, category: Optional[str]
) -> str:
    """Return CSV string for all transactions matching the given filters."""
    sql = """
        SELECT transaction_date, category, amount, description
        FROM transactions
        WHERE transaction_date >= %s AND transaction_date <= %s
        ORDER BY transaction_date ASC
    """
    params: tuple = (start_date.isoformat(), end_date.isoformat())
    if category and category != "All":
        sql = """
            SELECT transaction_date, category, amount, description
            FROM transactions
            WHERE transaction_date >= %s AND transaction_date <= %s AND category = %s
            ORDER BY transaction_date ASC
        """
        params = (start_date.isoformat(), end_date.isoformat(), category)
    with get_connection() as conn:
        rows = execute_query(sql, params, conn=conn)

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS)
    writer.writeheader()
    for row in rows:
        writer.writerow(
            {
                "transaction_date": row.get("transaction_date", ""),
                "category": row.get("category", ""),
                "amount": row.get("amount", ""),
                "description": row.get("description") or "",
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
            "description": "Weekly groceries",
        },
        {
            "transaction_date": "2026-03-02",
            "category": "Dining",
            "amount": "450",
            "description": "Lunch",
        },
        {
            "transaction_date": "2026-03-03",
            "category": "Transportation",
            "amount": "320",
            "description": "",
        },
    ]
    for row in example_rows:
        writer.writerow(row)
    return output.getvalue()


def import_transactions_from_csv(content: bytes) -> tuple[int, list[str]]:
    """
    Parse CSV content and insert valid rows into the transactions table.

    Expected columns (case-insensitive): transaction_date (YYYY-MM-DD), category, amount, description (optional).
    Returns (inserted_count, list of error messages for failed rows).
    """
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))

    if reader.fieldnames is None:
        return 0, ["CSV file has no header row."]

    header_map = {name.lower(): name for name in reader.fieldnames}
    required_cols = ["transaction_date", "category", "amount"]
    missing = [c for c in required_cols if c not in header_map]
    if missing:
        return 0, [
            "Missing required column(s): "
            + ", ".join(missing)
            + ". Expected at least: transaction_date, category, amount."
        ]

    errors: list[str] = []
    rows_to_insert: list[tuple] = []

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

            tx = TransactionCreate(
                amount=parsed_amount,
                category=raw_category,
                transaction_date=parsed_date,
                description=raw_description,
            )
            rows_to_insert.append(
                (
                    float(tx.amount),
                    tx.category.strip(),
                    tx.transaction_date.isoformat(),
                    tx.description,
                )
            )
        except Exception as e:
            errors.append(f"Row {idx}: {e}")

    inserted_count = 0
    if rows_to_insert:
        sql = """
            INSERT INTO transactions (amount, category, transaction_date, description)
            VALUES (%s, %s, %s, %s)
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, rows_to_insert)
        inserted_count = len(rows_to_insert)

    return inserted_count, errors
