"""
CSV export, template, and import for transactions.
Uses tracker.database and tracker.schemas; no UI dependencies.
"""

import csv
import io
from datetime import date
from typing import Any, Optional

from tracker.database import execute_query, CONNECTION_REQUIRED_MSG
from tracker.schemas import TransactionCreate

# CSV column names (used for export, template, and import)
CSV_FIELDS = ["transaction_date", "category", "amount", "description"]


def export_transactions_csv(
    start_date: date, end_date: date, category: Optional[str], conn: Any
) -> str:
    """Return CSV string for all transactions matching the given filters. conn is required."""
    if conn is None:
        raise ValueError(CONNECTION_REQUIRED_MSG)
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


def import_transactions_from_csv(content: bytes, conn: Any) -> tuple[int, list[str]]:
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

            try:
                parsed_date = date.fromisoformat(raw_date)
            except ValueError:
                raise ValueError(
                    f"Invalid date format '{raw_date}'. Use YYYY-MM-DD."
                )

            try:
                parsed_amount = float(raw_amount)
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
        if conn is None:
            raise ValueError(CONNECTION_REQUIRED_MSG)
        sql = """
            INSERT INTO transactions (amount, category, transaction_date, description)
            VALUES (%s, %s, %s, %s)
        """
        with conn.cursor() as cur:
            cur.executemany(sql, rows_to_insert)
        conn.commit()
        inserted_count = len(rows_to_insert)

    return inserted_count, errors
