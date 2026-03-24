from fastapi import APIRouter, Query

from tracker.schemas import (
    DashboardOverviewResponse,
)
from tracker.services import (
    get_dashboard_overview,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/overview", response_model=DashboardOverviewResponse)
def dashboard_overview(
    months: int = Query(6, ge=1, le=24),
    recent_limit: int = Query(5, ge=1, le=20),
) -> DashboardOverviewResponse:
    return DashboardOverviewResponse(
        **get_dashboard_overview(months=months, recent_limit=recent_limit)
    )
