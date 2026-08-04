"""Tests for per-user bank profile helpers."""

from datetime import date
import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tracker import bank_service

pytestmark = pytest.mark.anyio

USER_ID = uuid.UUID("55555555-5555-5555-5555-555555555555")


def test_validate_bank_name_accepts_catalog_and_rejects_others():
    assert bank_service.validate_bank_name("SBI") == "SBI"
    assert bank_service.validate_bank_name(" Kotak ") == "Kotak"
    with pytest.raises(ValueError, match="Invalid bank"):
        bank_service.validate_bank_name("HDFC")
    with pytest.raises(ValueError, match="select a bank"):
        bank_service.validate_bank_name("")


def test_parse_opening_month_normalizes_to_first():
    assert bank_service.parse_opening_month("2026-03") == date(2026, 3, 1)
    with pytest.raises(ValueError, match="YYYY-MM"):
        bank_service.parse_opening_month("2026-13")
    with pytest.raises(ValueError, match="opening month"):
        bank_service.parse_opening_month("")


def test_validate_opening_balance_allows_zero_rejects_negative():
    assert float(bank_service.validate_opening_balance("0")) == 0.0
    assert float(bank_service.validate_opening_balance(50000)) == 50000.0
    with pytest.raises(ValueError, match="negative"):
        bank_service.validate_opening_balance("-1")
    with pytest.raises(ValueError, match="must be a number"):
        bank_service.validate_opening_balance("abc")


async def test_assert_bank_writable_requires_active_profile_bank():
    with patch.object(
        bank_service,
        "list_active_bank_names",
        new_callable=AsyncMock,
        return_value=["SBI", "Kotak"],
    ):
        assert await bank_service.assert_bank_writable(USER_ID, "SBI") == "SBI"
        with pytest.raises(ValueError, match="not an active bank"):
            await bank_service.assert_bank_writable(USER_ID, "Slice")
