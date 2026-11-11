"""Category suggestions for statement imports: merchant keys and history match."""

from datetime import date
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
import uuid

import pytest
from sqlalchemy import delete

os.environ.setdefault("JWT_SECRET", "test-secret-key-for-pytest-only!!")

from auth.models import User
from common.database import get_connection, is_database_configured
from tracker.category_service import (
    _history_by_merchant,
    category_key,
    merchant_key,
    suggest_categories,
)
from tracker.models import Transaction

pytestmark = pytest.mark.anyio

KNOWN = {category_key(name): name for name in ["Food", "Groceries", "Rent", "Shopping"]}


def _row(source_row: int, description: str, *, is_debit: str = "true", amount: str = "100.00"):
    return SimpleNamespace(
        source_row=source_row,
        description=description,
        category="",
        is_debit=is_debit,
        amount=amount,
    )


def test_merchant_key_same_merchant_different_refs():
    upi = merchant_key("UPI/DR/4123/SWIGGY/YESB/swiggy@ybl/Payment")
    assert upi == "SWIGGY"
    assert merchant_key("UPI/DR/9988/SWIGGY/HDFC/swiggy@ybl/Payment") == upi
    assert merchant_key("Swiggy") == upi


def test_merchant_key_slice_style():
    text = "UPI-Credit-624528738839-BORA BHARAT RED DY-KKBK0000333-7002681900@slc-SR6d6948"
    assert merchant_key(text) == "BORA BHARAT RED"


def test_merchant_key_noise_only_is_empty():
    assert merchant_key("UPI CREDIT") == ""
    assert merchant_key("NEFT/123456789") == ""
    assert merchant_key("") == ""


def test_history_requires_clear_majority():
    history = [("Swiggy", "Food")] * 3 + [("Friend", "Rent")] * 5 + [("Friend", "Food")] * 4
    decided = _history_by_merchant(history, KNOWN)
    assert decided == {"SWIGGY": "Food"}


def test_history_exact_tie_is_unmatched():
    history = [("Friend", "Rent"), ("Friend", "Food")]
    assert _history_by_merchant(history, KNOWN) == {}


def test_history_ignores_categories_no_longer_known():
    assert _history_by_merchant([("Swiggy", "Deleted category")], KNOWN) == {}


async def test_suggest_matches_history_and_leaves_unknown_blank():
    history = [("Swiggy", "Food")]
    with patch(
        "tracker.category_service._load_history", new=AsyncMock(return_value=history)
    ):
        result = await suggest_categories(
            uuid.uuid4(), [_row(1, "UPI/DR/1/SWIGGY/YESB"), _row(2, "UPI/DR/2/ZEPTO/YESB")], KNOWN
        )
    assert result == {1: "Food"}


async def test_suggest_survives_history_failure():
    with patch(
        "tracker.category_service._load_history",
        new=AsyncMock(side_effect=RuntimeError("db down")),
    ):
        result = await suggest_categories(uuid.uuid4(), [_row(1, "ZEPTO")], KNOWN)
    assert result == {}


async def test_suggest_ignores_filled_rows_and_empty_keys():
    filled = _row(1, "SWIGGY")
    filled.category = "Food"
    load = AsyncMock(return_value=[("Swiggy", "Food")])
    with patch("tracker.category_service._load_history", new=load):
        result = await suggest_categories(uuid.uuid4(), [filled, _row(2, "UPI CREDIT")], KNOWN)
    assert result == {}
    load.assert_not_called()


@pytest.mark.skipif(not is_database_configured(), reason="DATABASE_URL not set")
async def test_suggest_history_from_real_ledger():
    user_id = uuid.uuid4()
    user = User(
        id=user_id,
        username=f"suggest-{user_id}",
        email=f"{user_id}@example.com",
        password_hash="x",
    )
    txns = [
        Transaction(
            id=uuid.uuid4(),
            user_id=user_id,
            amount=250,
            is_debit=True,
            category="Food",
            bank="SBI",
            transaction_date=date(2026, 1, 5),
            description="UPI/DR/5555/SWIGGY/YESB/swiggy@ybl",
        )
    ]
    try:
        async with get_connection() as session:
            session.add(user)
            await session.flush()
            session.add_all(txns)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"database not reachable: {exc}")
    try:
        result = await suggest_categories(
            user_id, [_row(1, "UPI/DR/9999/SWIGGY/HDFC/swiggy@ybl")], KNOWN
        )
    finally:
        async with get_connection() as session:
            await session.execute(delete(Transaction).where(Transaction.user_id == user_id))
            await session.execute(delete(User).where(User.id == user_id))
    assert result == {1: "Food"}
