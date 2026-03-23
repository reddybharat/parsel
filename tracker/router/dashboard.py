from fastapi import APIRouter, Query

from tracker.schemas import (
    DashboardHighlightsResponse,
    DashboardRecentResponse,
    DashboardSummaryResponse,
    DashboardTrendResponse,
)
from tracker.services import (
    get_dashboard_highlights,
    get_dashboard_recent,
    get_dashboard_summary,
    get_dashboard_trend,
)

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummaryResponse)
def dashboard_summary() -> DashboardSummaryResponse:
    return DashboardSummaryResponse(**get_dashboard_summary())


@router.get("/trend", response_model=DashboardTrendResponse)
def dashboard_trend(months: int = Query(6, ge=1, le=24)) -> DashboardTrendResponse:
    return DashboardTrendResponse(**get_dashboard_trend(months=months))


@router.get("/recent", response_model=DashboardRecentResponse)
def dashboard_recent(limit: int = Query(5, ge=1, le=20)) -> DashboardRecentResponse:
    return DashboardRecentResponse(**get_dashboard_recent(limit=limit))


@router.get("/highlights", response_model=DashboardHighlightsResponse)
def dashboard_highlights() -> DashboardHighlightsResponse:
    return DashboardHighlightsResponse(**get_dashboard_highlights())
