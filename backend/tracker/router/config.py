from fastapi import APIRouter, Depends

from auth.deps import get_current_user
from auth.models import User
from tracker.constants import CATEGORIES, PAYMENT_METHODS

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/tracker")
async def tracker_config(current_user: User = Depends(get_current_user)) -> dict:
    del current_user  # auth gate only; categories are shared
    return {
        "categories": CATEGORIES,
        "payment_methods": PAYMENT_METHODS,
    }
