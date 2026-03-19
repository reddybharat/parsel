from datetime import date, datetime
from typing import Optional
from uuid import UUID
import time

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile

from common.database import get_connection
from common.logger import get_logger
from tracker.services import export_transactions_csv, import_transactions_from_csv
from tracker.schemas import (
    TransactionCreate,
    TransactionResponse,
    TransactionUpdate,
    TransactionsSearchResult,
)
from tracker.validations import validate_transaction_date
from tracker.utils.db import (
    execute_insert,
    execute_query,
    execute_update_delete,
    execute_update_returning,
)


logger = get_logger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])

_COLS = "id, amount, category, transaction_date, description, created_at, updated_at, version_no"


def _parse_datetime(value) -> datetime:
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


@router.get("/search", response_model=TransactionsSearchResult)
def search_transactions(
    start_date: date = Query(...),
    end_date: date = Query(...),
    category: Optional[str] = Query(None),
    sort_column: str = Query("transaction_date"),
    sort_desc: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
) -> TransactionsSearchResult:
    t0 = time.perf_counter()
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")

    allowed_sort_columns = {"transaction_date", "amount"}
    if sort_column not in allowed_sort_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_column. Allowed values: {', '.join(sorted(allowed_sort_columns))}",
        )

    order_dir = "DESC" if sort_desc else "ASC"
    order_clause = f"ORDER BY {sort_column} {order_dir}"

    offset_start = (page - 1) * page_size

    if category and category != "All":
        count_sql = """
            SELECT COUNT(*) AS n FROM transactions
            WHERE transaction_date >= %s AND transaction_date <= %s AND category = %s
        """
        count_params: tuple = (start_date.isoformat(), end_date.isoformat(), category)
        data_sql = f"""
            SELECT {_COLS} FROM transactions
            WHERE transaction_date >= %s AND transaction_date <= %s AND category = %s
            {order_clause}
            LIMIT %s OFFSET %s
        """
        data_params = (start_date.isoformat(), end_date.isoformat(), category, page_size, offset_start)
    else:
        count_sql = """
            SELECT COUNT(*) AS n FROM transactions
            WHERE transaction_date >= %s AND transaction_date <= %s
        """
        count_params = (start_date.isoformat(), end_date.isoformat())
        data_sql = f"""
            SELECT {_COLS} FROM transactions
            WHERE transaction_date >= %s AND transaction_date <= %s
            {order_clause}
            LIMIT %s OFFSET %s
        """
        data_params = (start_date.isoformat(), end_date.isoformat(), page_size, offset_start)

    with get_connection() as conn:
        count_rows = execute_query(count_sql, count_params, conn=conn)
        total_count = int(count_rows[0]["n"]) if count_rows else 0
        rows = execute_query(data_sql, data_params, conn=conn)

    items = [_record_to_response(r) for r in rows]
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "search_transactions completed in %.1f ms (total=%d, page=%d, page_size=%d, category=%s, sort=%s %s)",
        elapsed_ms,
        total_count,
        page,
        page_size,
        category or "All",
        sort_column,
        "DESC" if sort_desc else "ASC",
    )
    return TransactionsSearchResult(
        total=total_count,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/export")
def export_transactions(
    start_date: date = Query(...),
    end_date: date = Query(...),
    category: Optional[str] = Query(None),
) -> Response:
    t0 = time.perf_counter()
    csv_data = export_transactions_csv(start_date, end_date, category)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "export_transactions completed in %.1f ms (category=%s, range=%s..%s)",
        elapsed_ms,
        category or "All",
        start_date.isoformat(),
        end_date.isoformat(),
    )
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="transactions_{start_date.isoformat()}_{end_date.isoformat()}.csv"'
        },
    )


@router.post("/import")
async def import_transactions(file: UploadFile = File(...)) -> dict:
    t0 = time.perf_counter()
    content = await file.read()
    inserted, errors = import_transactions_from_csv(content)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "import_transactions completed in %.1f ms (inserted=%d, errors=%d)",
        elapsed_ms,
        inserted,
        len(errors),
    )
    return {"inserted": inserted, "errors": errors}


@router.post("", response_model=TransactionResponse)
def create_transaction(payload: TransactionCreate) -> TransactionResponse:
    t0 = time.perf_counter()
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
    with get_connection() as conn:
        rows = execute_insert(sql, params, conn=conn)
    if not rows:
        raise HTTPException(status_code=500, detail="Insert failed")
    result = _record_to_response(rows[0])
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("create_transaction completed in %.1f ms (id=%s)", elapsed_ms, result.id)
    return result


@router.patch("/{transaction_id}", response_model=TransactionResponse)
def update_transaction(transaction_id: UUID, payload: TransactionUpdate) -> TransactionResponse:
    t0 = time.perf_counter()
    payload_dict = payload.model_dump(exclude_unset=True)
    if not payload_dict:
        raise HTTPException(status_code=400, detail="No fields provided for update")
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
    params.append(str(transaction_id))
    sql = (
        "UPDATE transactions SET "
        + ", ".join(set_parts)
        + " WHERE id = %s RETURNING id, amount, category, transaction_date, description, created_at, updated_at, version_no"
    )
    with get_connection() as conn:
        rows = execute_update_returning(sql, tuple(params), conn=conn)
    if not rows:
        raise HTTPException(status_code=404, detail="Transaction not found")
    result = _record_to_response(rows[0])
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("update_transaction completed in %.1f ms (id=%s)", elapsed_ms, result.id)
    return result


@router.delete("/{transaction_id}", status_code=204)
def delete_transaction(transaction_id: UUID) -> None:
    t0 = time.perf_counter()
    sql = "DELETE FROM transactions WHERE id = %s"
    with get_connection() as conn:
        rowcount = execute_update_delete(sql, (str(transaction_id),), conn=conn)
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("delete_transaction completed in %.1f ms (id=%s)", elapsed_ms, transaction_id)



