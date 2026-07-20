from fastapi import APIRouter, Depends, HTTPException, status

from auth.deps import get_current_user
from auth.models import User
from auth.schemas import (
    LoginRequest,
    MeResponse,
    RegisterRequest,
    TokenResponse,
    UpdateMeRequest,
    UpdateMeResponse,
    UserPreferences,
)
from auth.security import create_access_token, unauthorized
from auth.service import (
    AccountInactiveError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    UsernameAlreadyTakenError,
    authenticate_user,
    register_user,
    update_me,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _token_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(
            user_id=user.id,
            email=user.email,
            username=user.username,
        )
    )


def _preferences_model(user: User) -> UserPreferences:
    raw = user.preferences if isinstance(user.preferences, dict) else {}
    theme = raw.get("theme", "light")
    if theme not in ("light", "dark"):
        theme = "light"
    return UserPreferences(theme=theme)


def _me_response(user: User) -> MeResponse:
    return MeResponse(
        username=user.username,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        preferences=_preferences_model(user),
    )


def _update_me_response(user: User) -> UpdateMeResponse:
    token = _token_response(user)
    me = _me_response(user)
    return UpdateMeResponse(
        **me.model_dump(),
        access_token=token.access_token,
        token_type=token.token_type,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> TokenResponse:
    try:
        user = await register_user(body.username, body.email, body.password)
    except (EmailAlreadyRegisteredError, UsernameAlreadyTakenError) as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    return _token_response(user)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest) -> TokenResponse:
    try:
        user = await authenticate_user(body.login, body.password)
    except AccountInactiveError as exc:
        raise unauthorized(str(exc)) from exc
    except InvalidCredentialsError as exc:
        raise unauthorized(str(exc)) from exc
    return _token_response(user)


@router.post("/refresh", response_model=TokenResponse)
async def refresh(user: User = Depends(get_current_user)) -> TokenResponse:
    """Issue a new access token while the current one is still valid."""
    return _token_response(user)


@router.get("/me", response_model=MeResponse)
async def get_me(user: User = Depends(get_current_user)) -> MeResponse:
    return _me_response(user)


@router.patch("/me", response_model=UpdateMeResponse)
async def patch_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
) -> UpdateMeResponse:
    fields_set = body.model_fields_set
    kwargs: dict = {}
    if "username" in fields_set and body.username is not None:
        kwargs["username"] = body.username
    if "first_name" in fields_set:
        kwargs["first_name"] = body.first_name
    if "last_name" in fields_set:
        kwargs["last_name"] = body.last_name
    if "preferences" in fields_set and body.preferences is not None:
        kwargs["preferences"] = body.preferences.model_dump()

    if not kwargs:
        return _update_me_response(user)

    try:
        updated = await update_me(user.id, **kwargs)
        return _update_me_response(updated)
    except UsernameAlreadyTakenError as exc:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(exc)) from exc
    except AccountInactiveError as exc:
        raise unauthorized(str(exc)) from exc

