"""
CSV export, template, and import for transactions.
Uses tracker.utils.db and tracker.schemas; no UI dependencies.
"""

import csv
import io
from datetime import date, datetime, timedelta
from typing import Optional

from common.database import get_connection
from tracker.utils.db import execute_query
from tracker.schemas import TransactionCreate

# CSV column names (used for export, template, and import)
CSV_FIELDS = ["transaction_date", "category", "amount", "is_debit", "description"]


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


def export_transactions_csv(
    start_date: date, end_date: date, category: Optional[str]
) -> str:
    """Return CSV string for all transactions matching the given filters."""
    sql = """
        SELECT transaction_date, category, amount, is_debit, description
        FROM transactions
        WHERE transaction_date >= %s AND transaction_date <= %s
        ORDER BY transaction_date ASC
    """
    params: tuple = (start_date.isoformat(), end_date.isoformat())
    if category and category != "All":
        sql = """
            SELECT transaction_date, category, amount, is_debit, description
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
                "is_debit": str(bool(row.get("is_debit", True))).lower(),
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
            "is_debit": "true",
            "description": "Weekly groceries",
        },
        {
            "transaction_date": "2026-03-02",
            "category": "Dining",
            "amount": "450",
            "is_debit": "true",
            "description": "Lunch",
        },
        {
            "transaction_date": "2026-03-03",
            "category": "Transportation",
            "amount": "320",
            "is_debit": "false",
            "description": "",
        },
    ]
    for row in example_rows:
        writer.writerow(row)
    return output.getvalue()


def import_transactions_from_csv(content: bytes) -> tuple[int, list[str]]:
    """
    Parse CSV content and insert valid rows into the transactions table.

    Expected columns (case-insensitive):
    transaction_date (YYYY-MM-DD), category, amount, is_debit (optional but recommended), description (optional).
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
            raw_is_debit = (
                (row.get(header_map["is_debit"]) or "").strip()
                if "is_debit" in header_map
                else ""
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
            if "is_debit" in header_map:
                parsed_is_debit = _parse_is_debit(raw_is_debit)
            else:
                # Backward compatible default for older CSVs.
                parsed_is_debit = True

            tx = TransactionCreate(
                amount=parsed_amount,
                category=raw_category,
                transaction_date=parsed_date,
                description=raw_description,
                is_debit=parsed_is_debit,
            )
            rows_to_insert.append(
                (
                    float(tx.amount),
                    bool(tx.is_debit),
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
            INSERT INTO transactions (amount, is_debit, category, transaction_date, description)
            VALUES (%s, %s, %s, %s, %s)
        """
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.executemany(sql, rows_to_insert)
        inserted_count = len(rows_to_insert)

    return inserted_count, errors


def _month_start(d: date) -> date:
    return d.replace(day=1)


def _next_month_start(d: date) -> date:
    if d.month == 12:
        return date(d.year + 1, 1, 1)
    return date(d.year, d.month + 1, 1)


def _add_months(start: date, delta: int) -> date:
    total = (start.year * 12 + (start.month - 1)) + delta
    year = total // 12
    month = (total % 12) + 1
    return date(year, month, 1)


def get_dashboard_summary() -> dict:
    """Return portfolio net and month-over-month spend summary."""
    today = date.today()
    month_now_start = _month_start(today)
    month_next_start = _next_month_start(month_now_start)
    month_now_end = month_next_start - timedelta(days=1)
    month_prev_start = _add_months(month_now_start, -1)
    month_prev_end = month_now_start - timedelta(days=1)

    summary_sql = """
        SELECT
            COALESCE(SUM(CASE WHEN is_debit THEN -amount ELSE amount END), 0) AS portfolio_net,
            COALESCE(SUM(CASE
                WHEN is_debit = TRUE AND transaction_date >= %s AND transaction_date <= %s THEN amount
                ELSE 0
            END), 0) AS current_month_spend,
            COALESCE(SUM(CASE
                WHEN is_debit = TRUE AND transaction_date >= %s AND transaction_date <= %s THEN amount
                ELSE 0
            END), 0) AS previous_month_spend
        FROM transactions
    """
    params = (
        month_now_start.isoformat(),
        month_now_end.isoformat(),
        month_prev_start.isoformat(),
        month_prev_end.isoformat(),
    )
    with get_connection() as conn:
        rows = execute_query(summary_sql, params, conn=conn)
    row = rows[0] if rows else {}

    current_month_spend = float(row.get("current_month_spend", 0) or 0)
    previous_month_spend = float(row.get("previous_month_spend", 0) or 0)
    spend_delta_pct: Optional[float]
    if previous_month_spend > 0:
        spend_delta_pct = ((current_month_spend - previous_month_spend) / previous_month_spend) * 100.0
    else:
        spend_delta_pct = None

    return {
        "portfolio_net": float(row.get("portfolio_net", 0) or 0),
        "current_month_spend": current_month_spend,
        "previous_month_spend": previous_month_spend,
        "spend_delta_pct": spend_delta_pct,
    }


def get_dashboard_trend(months: int = 6) -> dict:
    """Return debit spend trend points for the last `months` months."""
    months = max(1, min(int(months), 24))
    today = date.today()
    current_month_start = _month_start(today)
    start_month = _add_months(current_month_start, -(months - 1))
    end_month = _next_month_start(current_month_start) - timedelta(days=1)

    sql = """
        SELECT date_trunc('month', transaction_date)::date AS month_start,
               COALESCE(SUM(amount), 0) AS spend
        FROM transactions
        WHERE is_debit = TRUE
          AND transaction_date >= %s
          AND transaction_date <= %s
        GROUP BY month_start
        ORDER BY month_start ASC
    """
    with get_connection() as conn:
        rows = execute_query(sql, (start_month.isoformat(), end_month.isoformat()), conn=conn)

    by_month: dict[str, float] = {}
    for r in rows:
        month_start = r.get("month_start")
        if month_start is None:
            continue
        month_key = month_start.isoformat() if hasattr(month_start, "isoformat") else str(month_start)
        by_month[month_key] = float(r.get("spend", 0) or 0)

    points: list[dict] = []
    for i in range(months):
        m = _add_months(start_month, i)
        key = m.isoformat()
        points.append({"month_label": m.strftime("%b"), "spend": by_month.get(key, 0.0)})
    return {"months": months, "points": points}


def get_dashboard_recent(limit: int = 5) -> dict:
    """Return most recent transactions for dashboard list."""
    limit = max(1, min(int(limit), 20))
    sql = """
        SELECT id, transaction_date, category, amount, is_debit, description
        FROM transactions
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT %s
    """
    with get_connection() as conn:
        rows = execute_query(sql, (limit,), conn=conn)

    items: list[dict] = []
    for row in rows:
        tx_date = row.get("transaction_date")
        parsed_date = tx_date if isinstance(tx_date, date) else date.fromisoformat(str(tx_date))
        items.append(
            {
                "id": str(row.get("id")),
                "transaction_date": parsed_date,
                "category": str(row.get("category") or ""),
                "amount": float(row.get("amount", 0) or 0),
                "is_debit": bool(row.get("is_debit", True)),
                "description": row.get("description"),
            }
        )
    return {"items": items}


def get_dashboard_highlights() -> dict:
    """Return current-month top category by spend plus total inflow/outflow."""
    today = date.today()
    month_start = _month_start(today)
    month_end = _next_month_start(month_start) - timedelta(days=1)
    with get_connection() as conn:
        top_category_rows = execute_query(
            """
            SELECT category, COALESCE(SUM(amount), 0) AS spend
            FROM transactions
            WHERE is_debit = TRUE
              AND transaction_date >= %s
              AND transaction_date <= %s
            GROUP BY category
            ORDER BY spend DESC
            LIMIT 1
            """,
            (month_start.isoformat(), month_end.isoformat()),
            conn=conn,
        )
        totals_rows = execute_query(
            """
            SELECT
                COALESCE(SUM(CASE WHEN is_debit = FALSE THEN amount ELSE 0 END), 0) AS total_inflow,
                COALESCE(SUM(CASE WHEN is_debit = TRUE THEN amount ELSE 0 END), 0) AS total_outflow
            FROM transactions
            WHERE transaction_date >= %s
              AND transaction_date <= %s
            """,
            (month_start.isoformat(), month_end.isoformat()),
            conn=conn,
        )

    top_category = top_category_rows[0] if top_category_rows else {}
    totals = totals_rows[0] if totals_rows else {}
    return {
        "top_category": {
            "category": top_category.get("category"),
            "spend": float(top_category.get("spend", 0) or 0),
        },
        "total_inflow": float(totals.get("total_inflow", 0) or 0),
        "total_outflow": float(totals.get("total_outflow", 0) or 0),
    }
