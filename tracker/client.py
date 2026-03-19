from __future__ import annotations

from datetime import date
from typing import Any

from common.api_client import delete, get, get_text, patch, post, post_multipart


def search_transactions(
    *,
    start_date: date,
    end_date: date,
    category: str,
    sort_column: str,
    sort_desc: bool,
    page: int,
    page_size: int,
) -> dict[str, Any]:
    return get(
        "/transactions/search",
        params={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "category": category,
            "sort_column": sort_column,
            "sort_desc": sort_desc,
            "page": page,
            "page_size": page_size,
        },
    )


def create_transaction(
    *,
    amount: float,
    category: str,
    transaction_date: date,
    description: str | None,
) -> dict[str, Any]:
    return post(
        "/transactions",
        json={
            "amount": float(amount),
            "category": category,
            "transaction_date": transaction_date.isoformat(),
            "description": description,
        },
    )


def export_transactions_csv(
    start_date: date,
    end_date: date,
    category: str,
) -> str:
    return get_text(
        "/transactions/export",
        params={
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "category": category,
        },
    )


def import_transactions_csv(content: bytes) -> dict[str, Any]:
    return post_multipart(
        "/transactions/import",
        files={"file": ("transactions_import.csv", content, "text/csv")},
    )


def update_transaction(
    *,
    transaction_id: str,
    amount: float,
    category: str,
    transaction_date: date,
    description: str | None,
) -> dict[str, Any]:
    return patch(
        f"/transactions/{transaction_id}",
        json={
            "amount": float(amount),
            "category": category,
            "transaction_date": transaction_date.isoformat(),
            "description": description,
        },
    )


def delete_transaction(*, transaction_id: str) -> None:
    delete(f"/transactions/{transaction_id}")

