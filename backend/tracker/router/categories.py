from fastapi import APIRouter, Depends, HTTPException

from auth.deps import get_current_user
from auth.models import User
from tracker.category_service import list_categories, register_category_name, rename_category
from tracker.schemas import CategoryCreate, CategoryRename, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


def _to_response(category) -> CategoryResponse:
    return CategoryResponse(name=category.name, is_system=bool(category.is_system))


@router.get("", response_model=list[CategoryResponse])
async def get_categories(current_user: User = Depends(get_current_user)) -> list[CategoryResponse]:
    del current_user
    rows = await list_categories()
    return [_to_response(row) for row in rows]


@router.post("", response_model=CategoryResponse, status_code=201)
async def post_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Validate a new category name for on-the-fly use (not persisted until a transaction uses it)."""
    del current_user
    try:
        category = await register_category_name(payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(category)


@router.patch("", response_model=CategoryResponse)
async def patch_category(
    payload: CategoryRename,
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Rename a custom category on all transactions that use it."""
    del current_user
    try:
        category = await rename_category(payload.old_name, payload.new_name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(category)
