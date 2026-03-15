"""
Transaction and summary API endpoints.
"""

from datetime import date, datetime

from fastapi import APIRouter, HTTPException

from tracker.database import (
    execute_insert,
    execute_query,
    execute_update_delete,
    execute_update_returning,
)
from tracker.schemas import TransactionCreate, TransactionResponse, TransactionUpdate
from tracker.validations import validate_transaction_date

router = APIRouter(prefix="", tags=["transactions"])

_COLS = "id, amount, category, transaction_date, description, created_at, updated_at, version_no"


def _parse_datetime(value) -> datetime:
    """Parse created_at/updated_at from DB (datetime or ISO string)."""
    if value is None:
        raise ValueError("created_at/updated_at cannot be null")
    if isinstance(value, datetime):
        return value
    if isinstance(value, str):
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    raise ValueError(f"Unexpected type for datetime: {type(value)}")


def _record_to_response(record: dict) -> TransactionResponse:
    return TransactionResponse(
        id=str(record["id"]),
        amount=float(record["amount"]),
        category=record["category"],
        transaction_date=(
            record["transaction_date"]
            if isinstance(record["transaction_date"], date)
            else date.fromisoformat(record["transaction_date"])
        ),
        description=record.get("description"),
        created_at=_parse_datetime(record["created_at"]),
        updated_at=_parse_datetime(record["updated_at"]),
        version_no=int(record["version_no"]),
    )


@router.post("/transactions", response_model=TransactionResponse)
def create_transaction(payload: TransactionCreate) -> TransactionResponse:
    """Insert a new transaction. Column names: amount, category, transaction_date, description."""
    try:
        validate_transaction_date(payload.transaction_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    sql = """
        INSERT INTO transactions (amount, category, transaction_date, description)
        VALUES (%s, %s, %s, %s)
        RETURNING id, amount, category, transaction_date, description, created_at, updated_at, version_no
    """
    params = (
        float(payload.amount),
        payload.category.strip(),
        payload.transaction_date.isoformat(),
        payload.description,
    )
    rows = execute_insert(sql, params)
    if not rows:
        raise HTTPException(status_code=500, detail="Insert failed")
    return _record_to_response(rows[0])


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
def get_transaction(transaction_id: str) -> TransactionResponse:
    """Fetch a single transaction by id."""
    sql = f"SELECT {_COLS} FROM transactions WHERE id = %s"
    rows = execute_query(sql, (transaction_id,))
    if not rows:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _record_to_response(rows[0])


@router.patch("/transactions/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: str, payload: TransactionUpdate) -> TransactionResponse:
    """Update a transaction by id. Only provided fields are updated."""
    payload_dict = payload.model_dump(exclude_unset=True)
    if not payload_dict:
        return get_transaction(transaction_id)
    if "transaction_date" in payload_dict:
        try:
            validate_transaction_date(payload_dict["transaction_date"])
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
    if "amount" in payload_dict:
        payload_dict["amount"] = float(payload_dict["amount"])
    if "transaction_date" in payload_dict:
        payload_dict["transaction_date"] = payload_dict["transaction_date"].isoformat()
    if "category" in payload_dict and payload_dict["category"] is not None:
        payload_dict["category"] = payload_dict["category"].strip()

    set_parts = []
    params = []
    for k, v in payload_dict.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    set_parts.append("updated_at = now()")
    set_parts.append("version_no = version_no + 1")
    params.append(transaction_id)
    sql = (
        "UPDATE transactions SET "
        + ", ".join(set_parts)
        + " WHERE id = %s RETURNING id, amount, category, transaction_date, description, created_at, updated_at, version_no"
    )
    rows = execute_update_returning(sql, tuple(params))
    if not rows:
        raise HTTPException(status_code=404, detail="Transaction not found")
    return _record_to_response(rows[0])


@router.delete("/transactions/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: str) -> None:
    """Delete a transaction by id."""
    sql = "DELETE FROM transactions WHERE id = %s"
    rowcount = execute_update_delete(sql, (transaction_id,))
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")


@router.get("/transactions", response_model=list[TransactionResponse])
def list_transactions() -> list[TransactionResponse]:
    """Fetch the last 20 transactions ordered by transaction_date descending."""
    sql = f"""
        SELECT {_COLS} FROM transactions
        ORDER BY transaction_date DESC
        LIMIT 20
    """
    rows = execute_query(sql)
    return [_record_to_response(r) for r in rows]


@router.get("/summary")
def get_summary() -> dict:
    """
    Current month summary:
    - total_spend: total amount for the current month
    - by_category: { "CategoryName": total_inr, ... }
    """
    today = date.today()
    start = today.replace(day=1).isoformat()
    end = today.isoformat()

    sql = """
        SELECT amount, category FROM transactions
        WHERE transaction_date >= %s AND transaction_date <= %s
    """
    rows = execute_query(sql, (start, end))

    total = 0.0
    by_category: dict[str, float] = {}
    for row in rows:
        amt = float(row.get("amount", 0))
        cat = row.get("category") or "Uncategorized"
        total += amt
        by_category[cat] = by_category.get(cat, 0) + amt

    return {
        "total_spend": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in sorted(by_category.items())},
        "month": today.strftime("%Y-%m"),
    }
