from fastapi import APIRouter, Depends

from auth.deps import get_current_user
from auth.models import User
from tracker.category_service import list_categories
from tracker.constants import PAYMENT_METHODS
from tracker.schemas import CategoryResponse

router = APIRouter(prefix="/config", tags=["config"])


@router.get("/tracker")
async def tracker_config(current_user: User = Depends(get_current_user)) -> dict:
    rows = await list_categories(current_user.id)
    return {
        "categories": [
            CategoryResponse(name=row.name, is_system=bool(row.is_system)).model_dump()
            for row in rows
        ],
        "payment_methods": PAYMENT_METHODS,
    }
