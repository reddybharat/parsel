from fastapi import APIRouter, HTTPException, status

from auth.models import User
from auth.schemas import LoginRequest, RegisterRequest, TokenResponse
from auth.security import create_access_token, unauthorized
from auth.service import (
    AccountInactiveError,
    EmailAlreadyRegisteredError,
    InvalidCredentialsError,
    UsernameAlreadyTakenError,
    authenticate_user,
    register_user,
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
