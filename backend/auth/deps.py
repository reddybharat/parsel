"""FastAPI dependencies for JWT auth."""

from __future__ import annotations

import uuid

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.models import User
from auth.security import decode_access_token, unauthorized
from auth.service import get_user_by_id

_bearer = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized("Not authenticated.")
    payload = decode_access_token(credentials.credentials)
    sub = payload.get("sub")
    try:
        user_id = uuid.UUID(str(sub))
    except (TypeError, ValueError) as exc:
        raise unauthorized("Invalid token subject.") from exc

    user = await get_user_by_id(user_id)
    if user is None:
        raise unauthorized("User not found.")
    return user
