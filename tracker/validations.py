"""
Validation helpers for the tracker. All validations raise ValueError with a message when invalid.
"""

from datetime import date

from tracker.constants import CATEGORIES


def validate_amount(amount: float) -> None:
    """Raise ValueError if amount is not greater than 0."""
    if amount is None or amount <= 0:
        raise ValueError("Amount must be greater than 0.")


def validate_category(category: str | None) -> None:
    """Raise ValueError if category is empty or not in CATEGORIES."""
    if not category or not (c := (category or "").strip()):
        raise ValueError("Please select a category.")
    if c not in CATEGORIES:
        raise ValueError(
            f"Invalid category: '{c}'. Must be one of: {', '.join(CATEGORIES)}."
        )


def validate_transaction_date(transaction_date: date) -> None:
    """Raise ValueError if transaction_date is in the future."""
    if transaction_date > date.today():
        raise ValueError("Transaction date cannot be in the future.")
