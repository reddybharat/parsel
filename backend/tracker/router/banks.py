from fastapi import APIRouter, Depends, HTTPException

from auth.deps import get_current_user
from auth.models import User
from tracker.bank_service import (
    UserBankInfo,
    add_user_bank,
    list_unregistered_transaction_banks,
    list_user_banks,
    update_user_bank,
)
from tracker.constants import BANKS
from tracker.schemas import UserBankCreate, UserBankResponse, UserBankUpdate

router = APIRouter(prefix="/banks", tags=["banks"])


def _to_response(info: UserBankInfo) -> UserBankResponse:
    return UserBankResponse(
        bank=info.bank,
        opening_balance=info.opening_balance,
        opening_month=info.opening_month,
        is_active=info.is_active,
    )


@router.get("", response_model=list[UserBankResponse])
async def get_banks(
    current_user: User = Depends(get_current_user),
) -> list[UserBankResponse]:
    """All profile banks (active + inactive) for the current user."""
    rows = await list_user_banks(current_user.id)
    return [_to_response(row) for row in rows]


@router.get("/setup")
async def get_bank_setup(current_user: User = Depends(get_current_user)) -> dict:
    """Onboarding/setup context: the bank catalog, current profile banks, and
    banks discovered on existing transactions but not yet added (soft migrate)."""
    profile = await list_user_banks(current_user.id)
    suggestions = await list_unregistered_transaction_banks(current_user.id)
    return {
        "catalog": BANKS,
        "banks": [_to_response(row).model_dump() for row in profile],
        "suggested_banks": suggestions,
    }


@router.post("", response_model=UserBankResponse, status_code=201)
async def post_bank(
    payload: UserBankCreate,
    current_user: User = Depends(get_current_user),
) -> UserBankResponse:
    try:
        info = await add_user_bank(
            current_user.id,
            bank=payload.bank,
            opening_balance=payload.opening_balance,
            opening_month=payload.opening_month,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(info)


@router.patch("/{bank}", response_model=UserBankResponse)
async def patch_bank(
    bank: str,
    payload: UserBankUpdate,
    current_user: User = Depends(get_current_user),
) -> UserBankResponse:
    try:
        info = await update_user_bank(
            current_user.id,
            bank,
            opening_balance=payload.opening_balance,
            opening_month=payload.opening_month,
            is_active=payload.is_active,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(info)
