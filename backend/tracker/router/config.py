from fastapi import APIRouter

from tracker.constants import CATEGORIES, PAYMENT_METHODS

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/tracker")
async def tracker_config() -> dict:
    return {
        "categories": CATEGORIES,
        "payment_methods": PAYMENT_METHODS,
    }
