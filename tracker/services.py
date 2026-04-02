"""
CSV export, template, and import for transactions.
Uses SQLAlchemy async session and tracker schemas; no UI dependencies.
"""

import csv
import io
import json
from datetime import date, datetime
from typing import Optional

from common.database import get_connection
from sqlalchemy import select, text

from tracker.constants import INVESTMENTS_CATEGORY
from tracker.models import Transaction
from tracker.schemas import TransactionCreate

# CSV column names (used for export, template, and import)
CSV_FIELDS = [
    "transaction_date",
    "category",
    "amount",
    "is_debit",
    "description",
    "payment_method",
]


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


async def export_transactions_csv(
    start_date: date,
    end_date: date,
    category: Optional[str],
    payment_method: Optional[str] = None,
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
        )
        .where(Transaction.transaction_date >= start_date)
        .where(Transaction.transaction_date <= end_date)
        .order_by(Transaction.transaction_date.asc())
    )
    if category and category != "All":
        stmt = stmt.where(Transaction.category == category)
    if payment_method and payment_method != "All":
        stmt = stmt.where(Transaction.payment_method == payment_method)
    async with get_connection() as session:
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
        },
        {
            "transaction_date": "2026-03-02",
            "category": "Dining",
            "amount": "450",
            "is_debit": "true",
            "description": "Lunch",
            "payment_method": "Card",
        },
        {
            "transaction_date": "2026-03-03",
            "category": "Transportation",
            "amount": "320",
            "is_debit": "false",
            "description": "",
            "payment_method": "Cash",
        },
    ]
    for row in example_rows:
        writer.writerow(row)
    return output.getvalue()


async def import_transactions_from_csv(content: bytes) -> tuple[int, list[str]]:
    """
    Parse CSV content and insert valid rows into the transactions table.

    Expected columns (case-insensitive):
    transaction_date (YYYY-MM-DD), category, amount, is_debit (optional but recommended),
    description (optional), payment_method (optional; omitted or empty leaves it unset).
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
    rows_to_insert: list[dict] = []

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

            pm = raw_payment_method if raw_payment_method else None

            tx = TransactionCreate(
                amount=parsed_amount,
                category=raw_category,
                payment_method=pm,
                transaction_date=parsed_date,
                description=raw_description,
                is_debit=parsed_is_debit,
            )
            rows_to_insert.append(
                {
                    "amount": float(tx.amount),
                    "is_debit": bool(tx.is_debit),
                    "category": tx.category.strip(),
                    "payment_method": tx.payment_method.strip() if tx.payment_method else None,
                    "transaction_date": tx.transaction_date,
                    "description": tx.description,
                }
            )
        except Exception as e:
            errors.append(f"Row {idx}: {e}")

    inserted_count = 0
    if rows_to_insert:
        async with get_connection() as session:
            await session.execute(Transaction.__table__.insert(), rows_to_insert)
        inserted_count = len(rows_to_insert)

    return inserted_count, errors


async def get_dashboard_overview(months: int = 6, recent_limit: int = 5) -> dict:
    """Return dashboard summary, trend, recent, and highlights in one query."""
    months = max(1, min(int(months), 24))
    recent_limit = max(1, min(int(recent_limit), 20))
    trend_offset = months - 1

    sql = """
        WITH bounds AS (
          SELECT
            date_trunc('month', CURRENT_DATE)::date AS month_now_start,
            (date_trunc('month', CURRENT_DATE) + interval '1 month')::date AS month_next_start,
            (date_trunc('month', CURRENT_DATE) - (CAST(:trend_offset AS int) * interval '1 month'))::date AS trend_start
        ),
        summary AS (
          SELECT
            COALESCE(SUM(CASE WHEN t.is_debit THEN -t.amount ELSE t.amount END), 0)::float8 AS portfolio_net,
            COALESCE(SUM(CASE
              WHEN t.is_debit = TRUE
               AND t.category <> :investments_category
               AND t.transaction_date >= b.month_now_start
               AND t.transaction_date <  b.month_next_start
              THEN t.amount ELSE 0 END), 0)::float8 AS current_month_spend,
            COALESCE(SUM(CASE
              WHEN t.is_debit = TRUE
               AND t.category <> :investments_category
               AND t.transaction_date >= (b.month_now_start - interval '1 month')::date
               AND t.transaction_date <  b.month_now_start
              THEN t.amount ELSE 0 END), 0)::float8 AS previous_month_spend
          FROM transactions t
          CROSS JOIN bounds b
        ),
        trend_agg AS (
          SELECT
            date_trunc('month', t.transaction_date)::date AS month_start,
            COALESCE(SUM(t.amount), 0)::float8 AS spend
          FROM transactions t
          CROSS JOIN bounds b
          WHERE t.is_debit = TRUE
            AND t.category <> :investments_category
            AND t.transaction_date >= b.trend_start
            AND t.transaction_date <  b.month_next_start
          GROUP BY 1
        ),
        trend_series AS (
          SELECT generate_series(
            (SELECT trend_start FROM bounds),
            (SELECT month_now_start FROM bounds),
            interval '1 month'
          )::date AS month_start
        ),
        trend AS (
          SELECT json_agg(
            json_build_object(
              'month_label', to_char(ts.month_start, 'Mon'),
              'spend', COALESCE(ta.spend, 0)
            )
            ORDER BY ts.month_start
          ) AS points
          FROM trend_series ts
          LEFT JOIN trend_agg ta USING (month_start)
        ),
        recent AS (
          SELECT json_agg(
            json_build_object(
              'id', x.id::text,
              'transaction_date', x.transaction_date,
              'category', x.category,
              'payment_method', x.payment_method,
              'amount', x.amount::float8,
              'is_debit', x.is_debit,
              'description', x.description
            )
            ORDER BY x.transaction_date DESC, x.created_at DESC
          ) AS items
          FROM (
            SELECT id, transaction_date, category, payment_method, amount, is_debit, description, created_at
            FROM transactions
            ORDER BY transaction_date DESC, created_at DESC
            LIMIT :recent_limit
          ) x
        ),
        top_category AS (
          SELECT t.category, COALESCE(SUM(t.amount), 0)::float8 AS spend
          FROM transactions t
          CROSS JOIN bounds b
          WHERE t.is_debit = TRUE
            AND t.category <> :investments_category
            AND t.transaction_date >= b.month_now_start
            AND t.transaction_date <  b.month_next_start
          GROUP BY t.category
          ORDER BY spend DESC
          LIMIT 1
        ),
        totals AS (
          SELECT
            COALESCE(SUM(CASE WHEN t.is_debit = FALSE THEN t.amount ELSE 0 END), 0)::float8 AS total_inflow,
            COALESCE(SUM(CASE WHEN t.is_debit = TRUE  THEN t.amount ELSE 0 END), 0)::float8 AS total_outflow,
            COALESCE(SUM(CASE
              WHEN t.is_debit = TRUE AND t.category = :investments_category
              THEN t.amount ELSE 0 END), 0)::float8 AS current_month_investments
          FROM transactions t
          CROSS JOIN bounds b
          WHERE t.transaction_date >= b.month_now_start
            AND t.transaction_date <  b.month_next_start
        )
        SELECT
          json_build_object(
            'summary', json_build_object(
              'portfolio_net', s.portfolio_net,
              'current_month_spend', s.current_month_spend,
              'previous_month_spend', s.previous_month_spend,
              'spend_delta_pct', CASE
                WHEN s.previous_month_spend > 0
                THEN ((s.current_month_spend - s.previous_month_spend) / s.previous_month_spend) * 100.0
                ELSE NULL
              END
            ),
            'trend', json_build_object(
              'months', CAST(:months AS int),
              'points', COALESCE(t.points, '[]'::json)
            ),
            'recent', json_build_object(
              'items', COALESCE(r.items, '[]'::json)
            ),
            'highlights', json_build_object(
              'top_category', COALESCE(
                (SELECT json_build_object('category', tc.category, 'spend', tc.spend) FROM top_category tc),
                json_build_object('category', NULL, 'spend', 0.0)
              ),
              'total_inflow', tt.total_inflow,
              'total_outflow', tt.total_outflow,
              'current_month_investments', tt.current_month_investments
            )
          ) AS overview
        FROM summary s
        CROSS JOIN trend t
        CROSS JOIN recent r
        CROSS JOIN totals tt
    """
    async with get_connection() as session:
        result = await session.execute(
            text(sql),
            {
                "trend_offset": trend_offset,
                "recent_limit": recent_limit,
                "months": months,
                "investments_category": INVESTMENTS_CATEGORY,
            },
        )
        row = result.mappings().first()
    raw_overview = (row or {}).get("overview", {})
    if isinstance(raw_overview, str):
        return json.loads(raw_overview)
    if isinstance(raw_overview, dict):
        return raw_overview
    return {}
