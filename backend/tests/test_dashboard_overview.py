"""Tests for dashboard overview aggregates."""

from datetime import date
from unittest.mock import AsyncMock, MagicMock, patch
import uuid

import pytest

from tracker.constants import (
    INVESTMENTS_CATEGORY,
    NON_SPEND_CATEGORIES,
    SELF_TRANSFER_CATEGORY,
    SYSTEM_CATEGORIES,
    WALLET_TOP_UP_CATEGORY,
)
from tracker.services import _get_dashboard_aggregates, get_dashboard_overview

pytestmark = pytest.mark.anyio


async def test_transfer_categories_are_global_non_spend_categories():
    assert SELF_TRANSFER_CATEGORY in SYSTEM_CATEGORIES
    assert WALLET_TOP_UP_CATEGORY in SYSTEM_CATEGORIES
    assert NON_SPEND_CATEGORIES == (
        INVESTMENTS_CATEGORY,
        SELF_TRANSFER_CATEGORY,
        WALLET_TOP_UP_CATEGORY,
    )


async def test_money_lent_is_a_global_category_that_still_counts_as_spend():
    assert "Money Lent" in SYSTEM_CATEGORIES
    assert "Money Lent" not in NON_SPEND_CATEGORIES


def _aggregate_row(**overrides):
    base = {
        "portfolio_net": 1000.0,
        "current_month_spend": 300.0,
        "previous_month_spend": 250.0,
        "trend_rows": "[]",
        "total_inflow": 5000.0,
        "total_outflow": 3200.0,
        "current_month_investments": 800.0,
        "top_category": '{"category": "Grocery", "spend": 150.0}',
        "category_spend_rows": (
            '[{"category": "Grocery", "spend": 150.0}, {"category": "Dining", "spend": 80.0}]'
        ),
        "month_label": "Jul 2026",
        "daily_total": 300.0,
        "daily_points": "[]",
    }
    base.update(overrides)
    return base


async def test_get_dashboard_aggregates_parses_category_spend_sorted():
    bounds = {
        "month_now_start": date(2026, 7, 1),
        "month_next_start": date(2026, 8, 1),
        "prev_month_start": date(2026, 6, 1),
        "trend_start": date(2025, 8, 1),
    }
    mock_result = MagicMock()
    mock_result.mappings.return_value.first.return_value = _aggregate_row()

    mock_session = AsyncMock()
    mock_session.execute = AsyncMock(return_value=mock_result)

    mock_cm = AsyncMock()
    mock_cm.__aenter__.return_value = mock_session
    mock_cm.__aexit__.return_value = None

    with patch("tracker.services.get_readonly_connection", return_value=mock_cm):
        result = await _get_dashboard_aggregates(
            bounds,
            months=12,
            user_id=uuid.UUID("55555555-5555-5555-5555-555555555555"),
        )

    statement, params = mock_session.execute.await_args.args
    sql = " ".join(str(statement).split())
    assert sql.count(
        "category NOT IN ( :investments_category, :self_transfer_category, "
        ":wallet_top_up_category )"
    ) == 4
    assert "cm.category = :investments_category" in sql
    assert params["investments_category"] == INVESTMENTS_CATEGORY
    assert params["self_transfer_category"] == SELF_TRANSFER_CATEGORY
    assert params["wallet_top_up_category"] == WALLET_TOP_UP_CATEGORY

    items = result["category_spend"]["items"]
    assert len(items) == 2
    assert items[0] == {"category": "Grocery", "spend": 150.0}
    assert items[1] == {"category": "Dining", "spend": 80.0}
    assert all(item["category"] != INVESTMENTS_CATEGORY for item in items)


async def test_get_dashboard_overview_includes_category_spend():
    aggregates = {
        "summary": {
            "portfolio_net": 0.0,
            "current_month_spend": 0.0,
            "previous_month_spend": 0.0,
            "spend_delta_pct": None,
        },
        "trend_points": [],
        "highlights": {
            "top_category": {"category": None, "spend": 0.0},
            "total_inflow": 0.0,
            "total_outflow": 0.0,
            "current_month_investments": 0.0,
        },
        "daily_spend": {"month_label": "Jul 2026", "total": 0.0, "points": []},
        "category_spend": {"items": [{"category": "Grocery", "spend": 42.0}]},
    }

    with (
        patch(
            "tracker.services._get_dashboard_aggregates",
            new_callable=AsyncMock,
            return_value=aggregates,
        ),
        patch(
            "tracker.services._get_dashboard_recent",
            new_callable=AsyncMock,
            return_value=[],
        ),
    ):
        result = await get_dashboard_overview(
            months=12,
            recent_limit=12,
            user_id=uuid.UUID("55555555-5555-5555-5555-555555555555"),
        )

    assert result["category_spend"]["items"] == [{"category": "Grocery", "spend": 42.0}]
