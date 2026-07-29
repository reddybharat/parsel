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

from common.database import get_connection
from sqlalchemy import select, text

from tracker.category_service import (
    list_missing_category_names,
    resolve_category_name,
)
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
    *,
    user_id: uuid.UUID,
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
        .where(Transaction.user_id == user_id)
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


async def _parse_csv_transaction_rows(
    content: bytes,
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


async def preview_transactions_import(content: bytes) -> dict:
    """
    Parse CSV without inserting. Report new categories that would be created.
    """
    rows, errors, category_names = await _parse_csv_transaction_rows(content)
    new_categories = await list_missing_category_names(category_names)
    return {
        "valid_row_count": len(rows),
        "new_categories": new_categories,
        "errors": errors,
    }


async def import_transactions_from_csv(
    content: bytes,
    *,
    user_id: uuid.UUID,
    create_missing_categories: bool = False,
) -> tuple[int, list[str], list[str]]:
    """
    Parse CSV content and insert valid rows into the transactions table.

    Expected columns (case-insensitive):
    transaction_date (YYYY-MM-DD), category, amount, is_debit (optional but recommended),
    description (optional), payment_method (optional; omitted or empty leaves it unset).
    Returns (inserted_count, errors, created_categories).
    """
    rows, errors, category_names = await _parse_csv_transaction_rows(content)
    if not rows and errors:
        return 0, errors, []

    created_categories: list[str] = []
    if create_missing_categories:
        created_categories = await list_missing_category_names(category_names)

    rows_to_insert: list[dict] = []
    for idx, row in enumerate(rows):
        try:
            canonical = await resolve_category_name(
                row["category"],
                allow_new=create_missing_categories,
            )
            rows_to_insert.append(
                {
                    "user_id": user_id,
                    "amount": row["amount"],
                    "is_debit": row["is_debit"],
                    "category": canonical,
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


def _dashboard_bounds(months: int) -> dict[str, date]:
    month_now_start = date.today().replace(day=1)
    return {
        "month_now_start": month_now_start,
        "month_next_start": _add_months(month_now_start, 1),
        "prev_month_start": _add_months(month_now_start, -1),
        "trend_start": _add_months(month_now_start, -(months - 1)),
    }


def _dashboard_params(bounds: dict[str, date], user_id: uuid.UUID) -> dict[str, Any]:
    return {
        **bounds,
        "user_id": user_id,
        "investments_category": INVESTMENTS_CATEGORY,
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
),
spend_txns AS (
  SELECT cm.*
  FROM current_month cm
  WHERE cm.is_debit = TRUE
    AND cm.category <> :investments_category
),
summary AS (
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
  WHERE t.user_id = :user_id
),
trend_rows AS (
  SELECT
    date_trunc('month', t.transaction_date)::date AS month_start,
    COALESCE(SUM(t.amount), 0)::float8 AS spend
  FROM transactions t
  WHERE t.user_id = :user_id
    AND t.is_debit = TRUE
    AND t.category <> :investments_category
    AND t.transaction_date >= :trend_start
    AND t.transaction_date < :month_next_start
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
) -> dict:
    """Single-query dashboard aggregates (summary, trend, highlights, daily spend)."""
    async with get_connection() as session:
        result = await session.execute(
            text(_DASHBOARD_AGGREGATES_SQL),
            _dashboard_params(bounds, user_id),
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


async def _get_dashboard_recent(recent_limit: int, *, user_id: uuid.UUID) -> list:
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
        WHERE user_id = :user_id
        ORDER BY transaction_date DESC, created_at DESC
        LIMIT :recent_limit
    """
    async with get_connection() as session:
        result = await session.execute(
            text(sql),
            {"recent_limit": recent_limit, "user_id": user_id},
        )
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


async def get_dashboard_overview(
    months: int = 12,
    recent_limit: int = 5,
    *,
    user_id: uuid.UUID,
) -> dict:
    """Return dashboard data via one aggregate query and one recent-transactions query."""
    months = max(1, min(int(months), 24))
    recent_limit = max(1, min(int(recent_limit), 20))
    bounds = _dashboard_bounds(months)

    aggregates, recent_items = await asyncio.gather(
        _get_dashboard_aggregates(bounds, months, user_id=user_id),
        _get_dashboard_recent(recent_limit, user_id=user_id),
    )

    return {
        "summary": aggregates["summary"],
        "trend": {"months": months, "points": aggregates["trend_points"]},
        "recent": {"items": recent_items},
        "highlights": aggregates["highlights"],
        "daily_spend": aggregates["daily_spend"],
        "category_spend": aggregates["category_spend"],
    }
