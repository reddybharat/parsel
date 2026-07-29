from datetime import date
from typing import Optional
from uuid import UUID
import time

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Response, UploadFile
from sqlalchemy import case, delete, func, insert, select, update

from auth.deps import get_current_user
from auth.models import User
from common.database import get_connection, get_readonly_connection
from common.logger import get_logger
from tracker.category_service import resolve_category_name
from tracker.models import Transaction
from tracker.schemas import (
    TransactionBulkDelete,
    TransactionBulkDeleteResult,
    TransactionCreate,
    TransactionResponse,
    TransactionsSearchResult,
    TransactionUpdate,
)
from tracker.services import (
    export_transactions_csv,
    import_transactions_from_csv,
    preview_transactions_import,
    transaction_text_search,
    transactions_csv_template,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/transactions", tags=["transactions"])


def _to_response(tx: Transaction) -> TransactionResponse:
    return TransactionResponse(
        id=str(tx.id),
        amount=float(tx.amount),
        is_debit=bool(tx.is_debit),
        category=tx.category,
        payment_method=tx.payment_method,
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
    q: Optional[str] = Query(None, max_length=200),
    category: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    is_debit: Optional[bool] = Query(None),
    sort_column: str = Query("transaction_date"),
    sort_desc: bool = Query(True),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
) -> TransactionsSearchResult:
    t0 = time.perf_counter()
    if start_date > end_date:
        raise HTTPException(status_code=400, detail="start_date must be on or before end_date")

    allowed_sort_columns = {"transaction_date", "amount", "category", "payment_method", "description"}
    if sort_column not in allowed_sort_columns:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort_column. Allowed values: {', '.join(sorted(allowed_sort_columns))}",
        )

    offset_start = (page - 1) * page_size

    where_parts = [
        Transaction.user_id == current_user.id,
        Transaction.transaction_date >= start_date,
        Transaction.transaction_date <= end_date,
    ]
    if category and category != "All":
        where_parts.append(Transaction.category == category)
    if payment_method and payment_method != "All":
        where_parts.append(Transaction.payment_method == payment_method)
    if is_debit is not None:
        where_parts.append(Transaction.is_debit == bool(is_debit))

    term = (q or "").strip()
    if term:
        where_parts.append(transaction_text_search(term))

    if sort_column == "amount":
        # Mixed debit+credit views should use signed values for correct net ordering.
        # Single-side filters (only debit or only credit) should sort by raw amount
        # so "largest transaction" remains intuitive.
        if is_debit is None:
            order_by = case(
                (Transaction.is_debit.is_(True), -Transaction.amount),
                else_=Transaction.amount,
            )
        else:
            order_by = Transaction.amount
    elif sort_column == "category":
        order_by = func.lower(Transaction.category)
    elif sort_column == "payment_method":
        order_by = func.lower(func.coalesce(Transaction.payment_method, ""))
    elif sort_column == "description":
        order_by = func.lower(func.coalesce(Transaction.description, ""))
    else:
        order_by = Transaction.transaction_date

    # Tie-breakers keep paging stable; window count avoids a second round trip.
    if sort_desc:
        order_by_clauses = [order_by.desc(), Transaction.created_at.desc(), Transaction.id.desc()]
    else:
        order_by_clauses = [order_by.asc(), Transaction.created_at.asc(), Transaction.id.asc()]

    page_stmt = (
        select(Transaction, func.count().over().label("total_count"))
        .where(*where_parts)
        .order_by(*order_by_clauses)
        .offset(offset_start)
        .limit(page_size)
    )

    async with get_readonly_connection() as session:
        result = (await session.execute(page_stmt)).all()
        if result:
            total_count = int(result[0][1])
        else:
            total_count = int(
                (
                    await session.execute(
                        select(func.count()).select_from(Transaction).where(*where_parts)
                    )
                ).scalar_one()
            )

    items = [_to_response(row[0]) for row in result]
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "search_transactions completed in %.1f ms (total=%d, page=%d, page_size=%d, q=%s, category=%s, sort=%s %s)",
        elapsed_ms,
        total_count,
        page,
        page_size,
        term or "-",
        category or "All",
        sort_column,
        "DESC" if sort_desc else "ASC",
    )
    return TransactionsSearchResult(total=total_count, page=page, page_size=page_size, items=items)


@router.get("/export")
async def export_transactions(
    start_date: date = Query(...),
    end_date: date = Query(...),
    q: Optional[str] = Query(None, max_length=200),
    category: Optional[str] = Query(None),
    payment_method: Optional[str] = Query(None),
    is_debit: Optional[bool] = Query(None),
    current_user: User = Depends(get_current_user),
) -> Response:
    t0 = time.perf_counter()
    csv_data = await export_transactions_csv(
        start_date,
        end_date,
        category,
        payment_method,
        user_id=current_user.id,
        q=q,
        is_debit=is_debit,
    )
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


@router.post("/import/preview")
async def import_transactions_preview(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
) -> dict:
    del current_user
    t0 = time.perf_counter()
    content = await file.read()
    result = await preview_transactions_import(content)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "import_transactions_preview completed in %.1f ms (valid=%d, new_categories=%d, errors=%d)",
        elapsed_ms,
        result["valid_row_count"],
        len(result["new_categories"]),
        len(result["errors"]),
    )
    return result


@router.post("/import")
async def import_transactions(
    file: UploadFile = File(...),
    create_missing_categories: bool = Form(False),
    current_user: User = Depends(get_current_user),
) -> dict:
    t0 = time.perf_counter()
    content = await file.read()
    inserted, errors, created_categories = await import_transactions_from_csv(
        content,
        user_id=current_user.id,
        create_missing_categories=create_missing_categories,
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "import_transactions completed in %.1f ms (inserted=%d, errors=%d, created_categories=%d)",
        elapsed_ms,
        inserted,
        len(errors),
        len(created_categories),
    )
    return {
        "inserted": inserted,
        "errors": errors,
        "created_categories": created_categories,
    }


@router.get("/import-template")
async def import_template(
    current_user: User = Depends(get_current_user),
) -> Response:
    del current_user  # auth gate only
    csv_data = transactions_csv_template()
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": 'attachment; filename="transactions_import_template.csv"'},
    )


@router.post("", response_model=TransactionResponse)
async def create_transaction(
    payload: TransactionCreate,
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
    t0 = time.perf_counter()
    try:
        canonical_category = await resolve_category_name(
            payload.category,
            allow_new=True,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    stmt = (
        insert(Transaction)
        .values(
            user_id=current_user.id,
            amount=float(payload.amount),
            is_debit=bool(payload.is_debit),
            category=canonical_category,
            payment_method=payload.payment_method.strip() if payload.payment_method else None,
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
async def update_transaction(
    transaction_id: UUID,
    payload: TransactionUpdate,
    current_user: User = Depends(get_current_user),
) -> TransactionResponse:
    t0 = time.perf_counter()
    payload_dict = payload.model_dump(exclude_unset=True)
    if not payload_dict:
        raise HTTPException(status_code=400, detail="No fields provided for update")
    if "amount" in payload_dict:
        payload_dict["amount"] = float(payload_dict["amount"])
    if "category" in payload_dict and payload_dict["category"] is not None:
        try:
            payload_dict["category"] = await resolve_category_name(
                payload_dict["category"],
                allow_new=True,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
    if "payment_method" in payload_dict and payload_dict["payment_method"] is not None:
        payload_dict["payment_method"] = payload_dict["payment_method"].strip()

    payload_dict["updated_at"] = func.now()
    payload_dict["version_no"] = Transaction.version_no + 1

    stmt = (
        update(Transaction)
        .where(Transaction.id == transaction_id, Transaction.user_id == current_user.id)
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


@router.post("/bulk-delete", response_model=TransactionBulkDeleteResult)
async def bulk_delete_transactions(
    payload: TransactionBulkDelete,
    current_user: User = Depends(get_current_user),
) -> TransactionBulkDeleteResult:
    t0 = time.perf_counter()
    stmt = delete(Transaction).where(
        Transaction.id.in_(payload.ids),
        Transaction.user_id == current_user.id,
    )
    async with get_connection() as session:
        result = await session.execute(stmt)
        deleted = result.rowcount or 0
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "bulk_delete_transactions completed in %.1f ms (requested=%d, deleted=%d)",
        elapsed_ms,
        len(payload.ids),
        deleted,
    )
    return TransactionBulkDeleteResult(deleted=deleted)


@router.delete("/{transaction_id}", status_code=204)
async def delete_transaction(
    transaction_id: UUID,
    current_user: User = Depends(get_current_user),
) -> None:
    t0 = time.perf_counter()
    stmt = delete(Transaction).where(
        Transaction.id == transaction_id,
        Transaction.user_id == current_user.id,
    )
    async with get_connection() as session:
        result = await session.execute(stmt)
        rowcount = result.rowcount or 0
    if rowcount == 0:
        raise HTTPException(status_code=404, detail="Transaction not found")
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info("delete_transaction completed in %.1f ms (id=%s)", elapsed_ms, transaction_id)
