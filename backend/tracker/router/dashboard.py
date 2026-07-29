import time

from fastapi import APIRouter, Depends, Query

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


@router.get("/overview", response_model=DashboardOverviewResponse)
async def dashboard_overview(
    months: int = Query(12, ge=1, le=24),
    recent_limit: int = Query(5, ge=1, le=20),
    current_user: User = Depends(get_current_user),
) -> DashboardOverviewResponse:
    t0 = time.perf_counter()
    result = DashboardOverviewResponse(
        **await get_dashboard_overview(
            months=months,
            recent_limit=recent_limit,
            user_id=current_user.id,
        )
    )
    elapsed_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "dashboard_overview completed in %.1f ms (months=%d, recent_limit=%d)",
        elapsed_ms,
        months,
        recent_limit,
    )
    return result
