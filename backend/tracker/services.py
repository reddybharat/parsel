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


def _dashboard_bounds(months: int) -> dict[str, date]:
    month_now_start = date.today().replace(day=1)
    return {
        "month_now_start": month_now_start,
        "month_next_start": _add_months(month_now_start, 1),
        "prev_month_start": _add_months(month_now_start, -1),
        "trend_start": _add_months(month_now_start, -(months - 1)),
    }


def _dashboard_params(bounds: dict[str, date]) -> dict[str, Any]:
    return {
        **bounds,
        "investments_category": INVESTMENTS_CATEGORY,
    }


def _parse_json_value(raw: Any, default: Any) -> Any:
    if raw is None:
        return default
    if isinstance(raw, str):
        return json.loads(raw)
    return raw


async def get_dashboard_summary(bounds: dict[str, date]) -> dict:
    sql = """
        SELECT
          COALESCE(SUM(CASE WHEN t.is_debit THEN -t.amount ELSE t.amount END), 0)::float8 AS portfolio_net,
          COALESCE(SUM(CASE
            WHEN t.is_debit = TRUE
             AND t.category <> :investments_category
             AND t.transaction_date >= :month_now_start
             AND t.transaction_date < :month_next_start
            THEN t.amount ELSE 0 END), 0)::float8 AS current_month_spend,
          COALESCE(SUM(CASE
            WHEN t.is_debit = TRUE
             AND t.category <> :investments_category
             AND t.transaction_date >= :prev_month_start
             AND t.transaction_date < :month_now_start
            THEN t.amount ELSE 0 END), 0)::float8 AS previous_month_spend
        FROM transactions t
    """
    async with get_connection() as session:
        result = await session.execute(text(sql), _dashboard_params(bounds))
        row = result.mappings().first() or {}

    current = float(row.get("current_month_spend") or 0)
    previous = float(row.get("previous_month_spend") or 0)
    spend_delta_pct = None
    if previous > 0:
        spend_delta_pct = ((current - previous) / previous) * 100.0

    return {
        "portfolio_net": float(row.get("portfolio_net") or 0),
        "current_month_spend": current,
        "previous_month_spend": previous,
        "spend_delta_pct": spend_delta_pct,
    }


async def get_dashboard_trend(months: int, bounds: dict[str, date]) -> list:
    sql = """
        WITH trend_agg AS (
          SELECT
            date_trunc('month', t.transaction_date)::date AS month_start,
            COALESCE(SUM(t.amount), 0)::float8 AS spend
          FROM transactions t
          WHERE t.is_debit = TRUE
            AND t.category <> :investments_category
            AND t.transaction_date >= :trend_start
            AND t.transaction_date < :month_next_start
          GROUP BY 1
        ),
        trend_series AS (
          SELECT generate_series(
            :trend_start,
            :month_now_start,
            interval '1 month'
          )::date AS month_start
        )
        SELECT json_agg(
          json_build_object(
            'month_label', to_char(ts.month_start, 'Mon'),
            'spend', COALESCE(ta.spend, 0)
          )
          ORDER BY ts.month_start
        ) AS points
        FROM trend_series ts
        LEFT JOIN trend_agg ta USING (month_start)
    """
    async with get_connection() as session:
        result = await session.execute(text(sql), _dashboard_params(bounds))
        row = result.mappings().first() or {}
    return _parse_json_value(row.get("points"), [])


async def get_dashboard_recent(recent_limit: int) -> list:
    sql = """
        SELECT
          id::text,
          transaction_date,
          category,
          payment_method,
          amount::float8 AS amount,
          is_debit,
          description
        FROM transactions
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT :recent_limit
    """
    async with get_connection() as session:
        result = await session.execute(text(sql), {"recent_limit": recent_limit})
        rows = result.mappings().all()

    return [
        {
            "id": row["id"],
            "transaction_date": row["transaction_date"],
            "category": row["category"],
            "payment_method": row["payment_method"],
            "amount": float(row["amount"] or 0),
            "is_debit": row["is_debit"],
            "description": row["description"],
        }
        for row in rows
    ]


async def get_dashboard_highlights(bounds: dict[str, date]) -> dict:
    sql = """
        SELECT
          COALESCE(SUM(CASE WHEN t.is_debit = FALSE THEN t.amount ELSE 0 END), 0)::float8 AS total_inflow,
          COALESCE(SUM(CASE WHEN t.is_debit = TRUE THEN t.amount ELSE 0 END), 0)::float8 AS total_outflow,
          COALESCE(SUM(CASE
            WHEN t.is_debit = TRUE AND t.category = :investments_category
            THEN t.amount ELSE 0 END), 0)::float8 AS current_month_investments,
          (
            SELECT json_build_object('category', tc.category, 'spend', tc.spend)
            FROM (
              SELECT t2.category, COALESCE(SUM(t2.amount), 0)::float8 AS spend
              FROM transactions t2
              WHERE t2.is_debit = TRUE
                AND t2.category <> :investments_category
                AND t2.transaction_date >= :month_now_start
                AND t2.transaction_date < :month_next_start
              GROUP BY t2.category
              ORDER BY spend DESC
              LIMIT 1
            ) tc
          ) AS top_category
        FROM transactions t
        WHERE t.transaction_date >= :month_now_start
          AND t.transaction_date < :month_next_start
    """
    async with get_connection() as session:
        result = await session.execute(text(sql), _dashboard_params(bounds))
        row = result.mappings().first() or {}

    top_category = _parse_json_value(
        row.get("top_category"),
        {"category": None, "spend": 0.0},
    )
    if not isinstance(top_category, dict):
        top_category = {"category": None, "spend": 0.0}

    return {
        "top_category": top_category,
        "total_inflow": float(row.get("total_inflow") or 0),
        "total_outflow": float(row.get("total_outflow") or 0),
        "current_month_investments": float(row.get("current_month_investments") or 0),
    }


async def get_dashboard_daily_spend(bounds: dict[str, date]) -> dict:
    sql = """
        WITH daily_agg AS (
          SELECT
            EXTRACT(DAY FROM t.transaction_date)::int AS day,
            COALESCE(SUM(t.amount), 0)::float8 AS spend
          FROM transactions t
          WHERE t.is_debit = TRUE
            AND t.category <> :investments_category
            AND t.transaction_date >= :month_now_start
            AND t.transaction_date < :month_next_start
          GROUP BY 1
        ),
        daily_series AS (
          SELECT generate_series(
            :month_now_start,
            :month_next_start - interval '1 day',
            interval '1 day'
          )::date AS day_date
        ),
        month_spend AS (
          SELECT COALESCE(SUM(t.amount), 0)::float8 AS total
          FROM transactions t
          WHERE t.is_debit = TRUE
            AND t.category <> :investments_category
            AND t.transaction_date >= :month_now_start
            AND t.transaction_date < :month_next_start
        )
        SELECT
          to_char(:month_now_start, 'Mon YYYY') AS month_label,
          (SELECT total FROM month_spend) AS total,
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
              LEFT JOIN daily_agg da ON da.day = EXTRACT(DAY FROM ds.day_date)::int
            ),
            '[]'::json
          ) AS points
    """
    async with get_connection() as session:
        result = await session.execute(text(sql), _dashboard_params(bounds))
        row = result.mappings().first() or {}

    return {
        "month_label": row.get("month_label") or "",
        "total": float(row.get("total") or 0),
        "points": _parse_json_value(row.get("points"), []),
    }


async def get_dashboard_overview(months: int = 12, recent_limit: int = 5) -> dict:
    """Return dashboard data via parallel focused queries."""
    months = max(1, min(int(months), 24))
    recent_limit = max(1, min(int(recent_limit), 20))
    bounds = _dashboard_bounds(months)

    summary, trend_points, recent_items, highlights, daily_spend = await asyncio.gather(
        get_dashboard_summary(bounds),
        get_dashboard_trend(months, bounds),
        get_dashboard_recent(recent_limit),
        get_dashboard_highlights(bounds),
        get_dashboard_daily_spend(bounds),
    )

    return {
        "summary": summary,
        "trend": {"months": months, "points": trend_points},
        "recent": {"items": recent_items},
        "highlights": highlights,
        "daily_spend": daily_spend,
    }
