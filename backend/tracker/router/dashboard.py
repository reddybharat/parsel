import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.deps import get_current_user
from auth.models import User
from common.logger import get_logger
from tracker.schemas import (
    DashboardOverviewResponse,
)
from tracker.services import (
    get_dashboard_overview,
)

logger = get_logger(__name__)
router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _parse_banks_query(banks: Optional[str]) -> list[str] | None:
    if banks is None or not str(banks).strip():
        return None
    return [part.strip() for part in str(banks).split(",") if part.strip()]


@router.get("/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview(
    months: int = Query(12, ge=1, le=24),
    recent_limit: int = Query(5, ge=1, le=20),
    month: Optional[str] = Query(
        None,
        pattern=r"^\d{4}-(0[1-9]|1[0-2])$",
        description="Focus month as YYYY-MM. Defaults to the current month.",
    ),
    banks: Optional[str] = Query(
        None,
        description="Optional comma-separated bank filter. Omit for all banks.",
    ),
    current_user: User = Depends(get_current_user),
) -> DashboardOverviewResponse:
    t0 = time.perf_counter()
    bank_list = _parse_banks_query(banks)
    try:
        payload = await get_dashboard_overview(
            months=months,
            recent_limit=recent_limit,
            user_id=current_user.id,
            month=month,
            banks=bank_list,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    result = DashboardOverviewResponse(**payload)
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "dashboard_overview completed in %.1f ms (months=%d, recent_limit=%d, month=%s, banks=%s)",
        elapsed_ms,
        months,
        recent_limit,
        month,
        banks,
    )
    return result
