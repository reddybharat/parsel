"""Insight of the month: facts by SQL, sentence phrased by the LLM, cached per user and month."""

from __future__ import annotations

import calendar
import json
import re
import uuid
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import text

from chat.agent.llm import ainvoke_with_retry, get_llm
from common.database import get_connection, get_readonly_connection
from common.logger import get_logger
from tracker.constants import (
    INVESTMENTS_CATEGORY,
    SELF_TRANSFER_CATEGORY,
    WALLET_TOP_UP_CATEGORY,
)

logger = get_logger(__name__)

INSIGHT_MAX_WORDS = 30
_NUMBER = re.compile(r"\d[\d,]*(?:\.\d+)?")

_SPEND_BY_CATEGORY_SQL = """
SELECT
  t.category AS category,
  COALESCE(SUM(CASE WHEN t.transaction_date >= :month_start THEN t.amount ELSE 0 END), 0)::float8 AS spend,
  COALESCE(SUM(CASE WHEN t.transaction_date < :month_start THEN t.amount ELSE 0 END), 0)::float8 AS prev_spend,
  COUNT(*) FILTER (WHERE t.transaction_date >= :month_start)::int AS txn_count
FROM transactions t
WHERE t.user_id = :user_id
  AND t.is_debit = TRUE
  AND t.category NOT IN (
    :investments_category, :self_transfer_category, :wallet_top_up_category
  )
  AND t.transaction_date >= :prev_month_start
  AND t.transaction_date < :next_month_start
GROUP BY t.category
"""

_TOP_DESCRIPTION_SQL = """
SELECT t.description AS description
FROM transactions t
WHERE t.user_id = :user_id
  AND t.is_debit = TRUE
  AND t.category = :category
  AND t.description IS NOT NULL
  AND t.transaction_date >= :month_start
  AND t.transaction_date < :next_month_start
GROUP BY t.description
ORDER BY COUNT(*) DESC, t.description
LIMIT 1
"""

_FINGERPRINT_SQL = """
SELECT
  COUNT(*)::int AS txn_count,
  COUNT(*) FILTER (WHERE t.transaction_date >= :month_start)::int AS month_txn_count,
  MAX(t.updated_at) AS last_updated
FROM transactions t
WHERE t.user_id = :user_id
  AND t.transaction_date >= :prev_month_start
  AND t.transaction_date < :next_month_start
"""

_CACHED_SQL = """
SELECT fingerprint, sentence, facts, questions, generated_at
FROM monthly_insights
WHERE user_id = :user_id AND month = :month_start
"""

_UPSERT_SQL = """
INSERT INTO monthly_insights (user_id, month, fingerprint, sentence, facts, questions, generated_at)
VALUES (:user_id, :month_start, :fingerprint, :sentence, CAST(:facts AS jsonb), CAST(:questions AS jsonb), now())
ON CONFLICT (user_id, month) DO UPDATE SET
  fingerprint = EXCLUDED.fingerprint,
  sentence = EXCLUDED.sentence,
  facts = EXCLUDED.facts,
  questions = EXCLUDED.questions,
  generated_at = EXCLUDED.generated_at
RETURNING generated_at
"""


def _month_label(month_start: date) -> str:
    return f"{calendar.month_name[month_start.month]} {month_start.year}"


def _inr(amount: float) -> str:
    digits = str(int(round(amount)))
    if len(digits) > 3:
        head = re.sub(r"(\d)(?=(\d\d)+$)", r"\1,", digits[:-3])
        digits = f"{head},{digits[-3:]}"
    return f"₹{digits}"


def _pct(current: float, previous: float) -> float | None:
    return None if previous <= 0 else (current - previous) / previous * 100.0


def _json_value(raw: Any) -> Any:
    return json.loads(raw) if isinstance(raw, str) else raw


def pick_insight_facts(rows: list[dict[str, Any]], month_start: date) -> dict[str, Any] | None:
    """Facts for the category with the largest absolute change; None when the month has no spend."""
    total = sum(row["spend"] for row in rows)
    if total <= 0:
        return None
    total_prev = sum(row["prev_spend"] for row in rows)
    top = max(rows, key=lambda row: (abs(row["spend"] - row["prev_spend"]), row["spend"]))
    prev_start = (month_start - timedelta(days=1)).replace(day=1)
    month_end = date(month_start.year, month_start.month, calendar.monthrange(month_start.year, month_start.month)[1])
    return {
        "category": top["category"],
        "spend": top["spend"],
        "prev_spend": top["prev_spend"],
        "delta_pct": _pct(top["spend"], top["prev_spend"]),
        "txn_count": top["txn_count"],
        "top_description": None,
        "total_spend": total,
        "total_prev_spend": total_prev,
        "total_delta_pct": _pct(total, total_prev),
        "month_label": _month_label(month_start),
        "prev_month_label": _month_label(prev_start),
        "month_start": month_start.isoformat(),
        "month_end": month_end.isoformat(),
    }


def _change_phrase(delta_pct: float | None) -> str:
    if delta_pct is None:
        return "no spend last month"
    return f"{'up' if delta_pct >= 0 else 'down'} {abs(round(delta_pct))}%"


def facts_text(facts: dict[str, Any]) -> str:
    """Plain-text facts: the only source the LLM may draw numbers from."""
    category, month, prev = facts["category"], facts["month_label"], facts["prev_month_label"]
    lines = [
        f"Month: {month} (compared with {prev})",
        f"Category with the biggest change: {category}",
        f"{category} spend in {month}: {_inr(facts['spend'])} across {facts['txn_count']} transactions",
        f"{category} spend in {prev}: {_inr(facts['prev_spend'])}",
        f"{category} change: {_change_phrase(facts['delta_pct'])}",
        f"Total spend in {month}: {_inr(facts['total_spend'])}, "
        f"{_change_phrase(facts['total_delta_pct'])} versus {prev}",
    ]
    if facts.get("top_description"):
        lines.append(f"Most frequent {category} description: {facts['top_description']}")
    return "\n".join(lines)


def template_sentence(facts: dict[str, Any]) -> str:
    if facts["delta_pct"] is None:
        change = f"with no spend in {facts['prev_month_label']}"
    else:
        change = f"{_change_phrase(facts['delta_pct'])} from {_inr(facts['prev_spend'])} in {facts['prev_month_label']}"
    return f"{facts['category']} spending was {_inr(facts['spend'])} in {facts['month_label']}, {change}."


def _numbers(value: str) -> set[str]:
    return {match.replace(",", "").rstrip(".") for match in _NUMBER.findall(value)}


def numbers_are_grounded(sentence: str, facts: dict[str, Any]) -> bool:
    """True when the sentence is non-empty and every number in it appears in the facts."""
    return bool(sentence.strip()) and _numbers(sentence) <= _numbers(facts_text(facts))


def build_questions(facts: dict[str, Any]) -> list[str]:
    category, month = facts["category"], facts["month_label"]
    if facts["delta_pct"] is None:
        first = f"What did I spend on {category} in {month}?"
    else:
        first = f"Why was {category} {'up' if facts['delta_pct'] >= 0 else 'down'} in {month}?"
    return [
        first,
        f"What were my biggest {category} transactions in {month}?",
        f"How much did I spend on weekends in {month}?",
        f"Which merchants did I spend the most at in {month}?",
    ]


async def _phrase(facts: dict[str, Any], user_id: uuid.UUID) -> str:
    prompt = (
        f"Write exactly one sentence of at most {INSIGHT_MAX_WORDS} words about this month's spending. "
        "Use only the facts below, copy numbers exactly as written, and give no advice.\n\n"
        f"{facts_text(facts)}"
    )
    try:
        response = await ainvoke_with_retry(get_llm(), prompt)
        sentence = " ".join(str(getattr(response, "content", "")).split()).strip('"')
        if numbers_are_grounded(sentence, facts):
            return sentence
        logger.warning("Insight sentence had ungrounded numbers; using template (user=%s, month=%s)", user_id, facts["month_start"])
    except Exception:  # noqa: BLE001 - any LLM failure falls back to the template
        logger.warning("Insight LLM failed; using template (user=%s, month=%s)", user_id, facts["month_start"], exc_info=True)
    return template_sentence(facts)


def _bounds(month_start: date) -> dict[str, date]:
    return {
        "month_start": month_start,
        "prev_month_start": (month_start - timedelta(days=1)).replace(day=1),
        "next_month_start": (month_start + timedelta(days=32)).replace(day=1),
    }


def _params(user_id: uuid.UUID, bounds: dict[str, date]) -> dict[str, Any]:
    return {"user_id": user_id, **bounds}


async def _load_fingerprint(user_id: uuid.UUID, bounds: dict[str, date]) -> tuple[str, int]:
    """(fingerprint, transactions in the focus month)."""
    async with get_readonly_connection() as session:
        row = (await session.execute(text(_FINGERPRINT_SQL), _params(user_id, bounds))).mappings().first() or {}
    last_updated = row.get("last_updated")
    fingerprint = f"{row.get('txn_count') or 0}:{last_updated.isoformat() if last_updated else ''}"
    return fingerprint, int(row.get("month_txn_count") or 0)


async def _load_cached(user_id: uuid.UUID, month_start: date) -> dict[str, Any] | None:
    async with get_readonly_connection() as session:
        row = (
            await session.execute(
                text(_CACHED_SQL), {"user_id": user_id, "month_start": month_start}
            )
        ).mappings().first()
    return dict(row) if row else None


async def _load_spend_rows(user_id: uuid.UUID, bounds: dict[str, date]) -> list[dict[str, Any]]:
    params = {
        **_params(user_id, bounds),
        "investments_category": INVESTMENTS_CATEGORY,
        "self_transfer_category": SELF_TRANSFER_CATEGORY,
        "wallet_top_up_category": WALLET_TOP_UP_CATEGORY,
    }
    async with get_readonly_connection() as session:
        rows = (await session.execute(text(_SPEND_BY_CATEGORY_SQL), params)).mappings().all()
    return [
        {
            "category": str(row["category"]),
            "spend": float(row["spend"] or 0),
            "prev_spend": float(row["prev_spend"] or 0),
            "txn_count": int(row["txn_count"] or 0),
        }
        for row in rows
    ]


async def _load_top_description(user_id: uuid.UUID, bounds: dict[str, date], category: str) -> str | None:
    async with get_readonly_connection() as session:
        row = (
            await session.execute(
                text(_TOP_DESCRIPTION_SQL),
                {**_params(user_id, bounds), "category": category},
            )
        ).mappings().first()
    return str(row["description"]) if row else None


async def _store(
    user_id: uuid.UUID,
    month_start: date,
    fingerprint: str,
    sentence: str,
    facts: dict[str, Any],
    questions: list[str],
) -> datetime:
    async with get_connection() as session:
        generated_at = (
            await session.execute(
                text(_UPSERT_SQL),
                {
                    "user_id": user_id,
                    "month_start": month_start,
                    "fingerprint": fingerprint,
                    "sentence": sentence,
                    "facts": json.dumps(facts),
                    "questions": json.dumps(questions),
                },
            )
        ).scalar_one()
    return generated_at


def _response(
    sentence: str, facts: dict[str, Any], questions: list[str], generated_at: datetime
) -> dict[str, Any]:
    return {
        "sentence": sentence,
        "facts": facts,
        "questions": questions,
        "generated_at": generated_at,
    }


async def get_monthly_insight(user_id: uuid.UUID, month: str) -> dict[str, Any] | None:
    """Insight for a "YYYY-MM" month, or None when the month has no spend."""
    month_start = date.fromisoformat(f"{month}-01")
    bounds = _bounds(month_start)

    fingerprint, month_txn_count = await _load_fingerprint(user_id, bounds)
    if month_txn_count == 0:
        return None

    cached = await _load_cached(user_id, month_start)
    if cached and cached["fingerprint"] == fingerprint:
        return _response(
            cached["sentence"],
            _json_value(cached["facts"]),
            _json_value(cached["questions"]),
            cached["generated_at"],
        )

    rows = await _load_spend_rows(user_id, bounds)
    facts = pick_insight_facts(rows, month_start)
    if facts is None:
        return None
    facts["top_description"] = await _load_top_description(user_id, bounds, facts["category"])

    sentence = await _phrase(facts, user_id)
    questions = build_questions(facts)
    generated_at = await _store(user_id, month_start, fingerprint, sentence, facts, questions)
    return _response(sentence, facts, questions, generated_at)
