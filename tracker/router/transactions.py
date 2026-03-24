from datetime import date
from typing import Optional
from uuid import UUID
import time

from fastapi import APIRouter, File, HTTPException, Query, Response, UploadFile
from sqlalchemy import case, delete, func, insert, select, update

from common.database import get_connection
from common.logger import get_logger
from tracker.models import Transaction
from tracker.schemas import (
    TransactionCreate,
    TransactionResponse,
    TransactionsSearchResult,
    TransactionUpdate,
)
from tracker.services import export_transactions_csv, import_transactions_from_csv
from tracker.validations import validate_transaction_date

logger = get_logger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_response(tx: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=str(tx.id),
        amount=float(tx.amount),
        is_debit=bool(tx.is_debit),
        category=tx.category,
        transaction_date=tx.transaction_date,
        description=tx.description,
        created_at=tx.created_at,
        updated_at=tx.updated_at,
        version_no=int(tx.version_no),
    )


@router.get("/search", response_model=TransactionsSearchResult)
async def search_transactions(
    start_date: date = Query(...),
    end_date: date = Query(...),
    category: Optional[str] = Query(None),
    is_debit: Optional[bool] = Query(None),
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

    offset_start = (page - 1) * page_size

    where_parts = [
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
    ]
    if category and category != "All":
        where_parts.append(Transaction.category == category)
    if is_debit is not None:
        where_parts.append(Transaction.is_debit == bool(is_debit))

    order_by = (
        case((Transaction.is_debit.is_(True), -Transaction.amount), else_=Transaction.amount)
        if sort_column == "amount"
        else Transaction.transaction_date
    )
    order_by = order_by.desc() if sort_desc else order_by.asc()

    async with get_connection() as session:
        total_count = int(
            (
                await session.execute(
                    select(func.count()).select_from(Transaction).where(*where_parts)
                )
            ).scalar_one()
        )
        rows = (
            await session.execute(
                select(Transaction)
                .where(*where_parts)
                .order_by(order_by)
                .offset(offset_start)
                .limit(page_size)
            )
        ).scalars().all()

    items = [_to_response(r) for r in rows]
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
    return TransactionsSearchResult(total=total_count, page=page, page_size=page_size, items=items)


@router.get("/export")
async def export_transactions(
    start_date: date = Query(...),
    end_date: date = Query(...),
    category: Optional[str] = Query(None),
) -> Response:
    t0 = time.perf_counter()
    csv_data = await export_transactions_csv(start_date, end_date, category)
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
    inserted, errors = await import_transactions_from_csv(content)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "import_transactions completed in %.1f ms (inserted=%d, errors=%d)",
        elapsed_ms,
        inserted,
        len(errors),
    )
    return {"inserted": inserted, "errors": errors}


@router.post("", response_model=TransactionResponse)
async def create_transaction(payload: TransactionCreate) -> TransactionResponse:
    t0 = time.perf_counter()
    try:
        validate_transaction_date(payload.transaction_date)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    stmt = (
        insert(Transaction)
        .values(
            amount=float(payload.amount),
            is_debit=bool(payload.is_debit),
            category=payload.category.strip(),
            transaction_date=payload.transaction_date,
            description=payload.description,
        )
        .returning(Transaction)
    )
    async with get_connection() as session:
        row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=500, detail="Insert failed")
    result = _to_response(row)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("create_transaction completed in %.1f ms (id=%s)", elapsed_ms, result.id)
    return result


@router.patch("/{transaction_id}", response_model=TransactionResponse)
async def update_transaction(transaction_id: UUID, payload: TransactionUpdate) -> TransactionResponse:
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
    if "category" in payload_dict and payload_dict["category"] is not None:
        payload_dict["category"] = payload_dict["category"].strip()

    payload_dict["updated_at"] = func.now()
    payload_dict["version_no"] = Transaction.version_no + 1

    stmt = (
        update(Transaction)
        .where(Transaction.id == transaction_id)
        .values(**payload_dict)
        .returning(Transaction)
    )
    async with get_connection() as session:
        row = (await session.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Transaction not found")
    result = _to_response(row)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("update_transaction completed in %.1f ms (id=%s)", elapsed_ms, result.id)
    return result


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(transaction_id: UUID) -> None:
    t0 = time.perf_counter()
    stmt = delete(Transaction).where(Transaction.id == transaction_id)
    async with get_connection() as session:
        result = await session.execute(stmt)
        rowcount = result.rowcount or 0
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("delete_transaction completed in %.1f ms (id=%s)", elapsed_ms, transaction_id)
