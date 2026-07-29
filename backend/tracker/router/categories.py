from fastapi import APIRouter, Depends, HTTPException, Query

from auth.deps import get_current_user
from auth.models import User
from tracker.category_service import (
    delete_category,
    list_categories,
    register_category_name,
    rename_category,
)
from tracker.schemas import CategoryCreate, CategoryRename, CategoryResponse

router = APIRouter(prefix="/categories", tags=["categories"])


def _to_response(category) -> CategoryResponse:
    return CategoryResponse(name=category.name, is_system=bool(category.is_system))


@router.get("", response_model=list[CategoryResponse])
async def get_categories(current_user: User = Depends(get_current_user)) -> list[CategoryResponse]:
    rows = await list_categories(current_user.id)
    return [_to_response(row) for row in rows]


@router.post("", response_model=CategoryResponse, status_code=201)
async def post_category(
    payload: CategoryCreate,
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Persist a custom category in the current user's preferences."""
    try:
        category = await register_category_name(current_user.id, payload.name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(category)


@router.patch("", response_model=CategoryResponse)
async def patch_category(
    payload: CategoryRename,
    current_user: User = Depends(get_current_user),
) -> CategoryResponse:
    """Rename one of the current user's custom categories and matching transactions."""
    try:
        category = await rename_category(
            current_user.id,
            payload.old_name,
            payload.new_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(category)


@router.delete("", status_code=204)
async def remove_category(
    name: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a custom category only when the current user has no transactions using it."""
    try:
        await delete_category(current_user.id, name)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
