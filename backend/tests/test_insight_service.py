"""Insight of the month: fact selection, number guard, template fallback, cache reuse (DB and LLM mocked)."""

from datetime import date, datetime, timezone
import os
from unittest.mock import AsyncMock, patch
import uuid

import pytest

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from tracker.insight_service import (
    build_questions,
    facts_text,
    get_monthly_insight,
    numbers_are_grounded,
    pick_insight_facts,
    template_sentence,
)

USER_ID = uuid.UUID("77777777-7777-7777-7777-777777777777")
SEPT = date(2026, 9, 1)
GENERATED_AT = datetime(2026, 10, 2, 9, 0, tzinfo=timezone.utc)

ROWS = [
    {"category": "Dining", "spend": 12000.0, "prev_spend": 8000.0, "txn_count": 14},
    {"category": "Grocery", "spend": 5000.0, "prev_spend": 4800.0, "txn_count": 9},
    {"category": "Rent", "spend": 20000.0, "prev_spend": 20000.0, "txn_count": 1},
]


def _facts(rows=ROWS):
    facts = pick_insight_facts(rows, SEPT)
    facts["top_description"] = "SWIGGY"
    return facts


def test_pick_insight_facts_takes_largest_absolute_change():
    facts = _facts()
    assert facts["category"] == "Dining"
    assert facts["delta_pct"] == pytest.approx(50.0)
    assert facts["total_spend"] == 37000.0
    assert facts["total_prev_spend"] == 32800.0
    assert facts["month_label"] == "September 2026"
    assert facts["prev_month_label"] == "August 2026"
    assert (facts["month_start"], facts["month_end"]) == ("2026-09-01", "2026-09-30")


def test_pick_insight_facts_none_without_spend():
    assert pick_insight_facts([], SEPT) is None
    assert pick_insight_facts([{"category": "Dining", "spend": 0.0, "prev_spend": 50.0, "txn_count": 0}], SEPT) is None


def test_new_category_has_no_delta_and_template_says_so():
    facts = _facts([{"category": "Gifts", "spend": 900.0, "prev_spend": 0.0, "txn_count": 2}])
    assert facts["delta_pct"] is None
    assert template_sentence(facts) == "Gifts spending was ₹900 in September 2026, with no spend in August 2026."


def test_template_sentence_uses_indian_grouping_and_direction():
    facts = _facts([{"category": "Dining", "spend": 123456.0, "prev_spend": 200000.0, "txn_count": 3}])
    assert template_sentence(facts) == (
        "Dining spending was ₹1,23,456 in September 2026, down 38% from ₹2,00,000 in August 2026."
    )


def test_template_sentence_passes_its_own_number_guard():
    facts = _facts()
    assert numbers_are_grounded(template_sentence(facts), facts)


def test_number_guard_rejects_invented_numbers_and_empty_text():
    facts = _facts()
    assert numbers_are_grounded("Dining rose 50% to ₹12,000 in September 2026.", facts)
    assert not numbers_are_grounded("Dining rose 63% to ₹12,000 in September 2026.", facts)
    assert not numbers_are_grounded("Dining rose to about 12k.", facts)
    assert not numbers_are_grounded("   ", facts)


def test_facts_text_contains_every_number_the_llm_may_use():
    text = facts_text(_facts())
    for expected in ("₹12,000", "₹8,000", "14 transactions", "up 50%", "₹37,000", "SWIGGY"):
        assert expected in text


def test_questions_name_the_absolute_month_never_this_month():
    questions = build_questions(_facts())
    assert 3 <= len(questions) <= 4
    assert all("September 2026" in question for question in questions)
    assert all("this month" not in question.lower() for question in questions)
    assert questions[0] == "Why was Dining up in September 2026?"


def _patch_db(*, cached, fingerprint=("5:2026-09-30T00:00:00", 4), rows=ROWS):
    return (
        patch("tracker.insight_service._load_fingerprint", new=AsyncMock(return_value=fingerprint)),
        patch("tracker.insight_service._load_cached", new=AsyncMock(return_value=cached)),
        patch("tracker.insight_service._load_spend_rows", new=AsyncMock(return_value=rows)),
        patch("tracker.insight_service._load_top_description", new=AsyncMock(return_value="SWIGGY")),
        patch("tracker.insight_service._store", new=AsyncMock(return_value=GENERATED_AT)),
    )


@pytest.mark.anyio
async def test_cached_insight_is_reused_when_fingerprint_matches():
    cached = {
        "fingerprint": "5:2026-09-30T00:00:00",
        "sentence": "Cached sentence.",
        "facts": _facts(),
        "questions": ["Q?"],
        "generated_at": GENERATED_AT,
    }
    fingerprint, load_cached, load_rows, load_top, store = _patch_db(cached=cached)
    with fingerprint, load_cached, load_rows as rows_mock, load_top, store as store_mock, patch(
        "tracker.insight_service.ainvoke_with_retry", new=AsyncMock()
    ) as llm_mock:
        result = await get_monthly_insight(USER_ID, "2026-09")

    assert result["sentence"] == "Cached sentence."
    assert result["questions"] == ["Q?"]
    rows_mock.assert_not_awaited()
    llm_mock.assert_not_awaited()
    store_mock.assert_not_awaited()


@pytest.mark.anyio
async def test_changed_fingerprint_regenerates_and_stores_llm_sentence():
    cached = {
        "fingerprint": "old",
        "sentence": "Stale.",
        "facts": {},
        "questions": [],
        "generated_at": GENERATED_AT,
    }
    reply = AsyncMock(return_value=type("R", (), {"content": "Dining rose 50% to ₹12,000 in September 2026."})())
    fingerprint, load_cached, load_rows, load_top, store = _patch_db(cached=cached)
    with fingerprint, load_cached, load_rows, load_top, store as store_mock, patch(
        "tracker.insight_service.get_llm"
    ), patch("tracker.insight_service.ainvoke_with_retry", new=reply):
        result = await get_monthly_insight(USER_ID, "2026-09")

    assert result["sentence"] == "Dining rose 50% to ₹12,000 in September 2026."
    assert result["facts"]["category"] == "Dining"
    assert result["facts"]["top_description"] == "SWIGGY"
    store_mock.assert_awaited_once()
    assert store_mock.await_args.args[2] == "5:2026-09-30T00:00:00"


@pytest.mark.anyio
async def test_ungrounded_llm_sentence_falls_back_to_template_and_is_cached():
    reply = AsyncMock(return_value=type("R", (), {"content": "Dining jumped 99% to ₹12,000."})())
    fingerprint, load_cached, load_rows, load_top, store = _patch_db(cached=None)
    with fingerprint, load_cached, load_rows, load_top, store as store_mock, patch(
        "tracker.insight_service.get_llm"
    ), patch("tracker.insight_service.ainvoke_with_retry", new=reply):
        result = await get_monthly_insight(USER_ID, "2026-09")

    assert result["sentence"] == template_sentence(result["facts"])
    store_mock.assert_awaited_once()


@pytest.mark.anyio
async def test_llm_error_falls_back_to_template_and_is_cached():
    fingerprint, load_cached, load_rows, load_top, store = _patch_db(cached=None)
    with fingerprint, load_cached, load_rows, load_top, store as store_mock, patch(
        "tracker.insight_service.get_llm", side_effect=RuntimeError("GROQ_API_KEY is not set")
    ):
        result = await get_monthly_insight(USER_ID, "2026-09")

    assert result["sentence"] == template_sentence(result["facts"])
    store_mock.assert_awaited_once()


@pytest.mark.anyio
async def test_month_without_transactions_returns_none():
    fingerprint, load_cached, load_rows, load_top, store = _patch_db(
        cached=None, fingerprint=("2:2026-08-30T00:00:00", 0)
    )
    with fingerprint, load_cached as cached_mock, load_rows, load_top, store:
        assert await get_monthly_insight(USER_ID, "2026-09") is None
    cached_mock.assert_not_awaited()
