"""Password hashing and JWT create/decode."""

from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import HTTPException, status

ALGORITHM = "HS256"
DEFAULT_EXPIRE_DAYS = 7


def unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_jwt_secret() -> str:
    secret = os.getenv("JWT_SECRET", "").strip()
    if not secret:
        raise RuntimeError("JWT_SECRET must be set in the environment.")
    return secret


def get_jwt_expire_days() -> int:
    raw = os.getenv("JWT_EXPIRE_DAYS", str(DEFAULT_EXPIRE_DAYS)).strip()
    try:
        days = int(raw)
    except ValueError as exc:
        raise RuntimeError("JWT_EXPIRE_DAYS must be an integer.") from exc
    if days < 1:
        raise RuntimeError("JWT_EXPIRE_DAYS must be >= 1.")
    return days


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except (ValueError, TypeError):
        return False


def create_access_token(*, user_id: uuid.UUID, email: str, username: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=get_jwt_expire_days())
    payload = {
        "sub": str(user_id),
        "email": email,
        "username": username,
        "exp": expire,
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise unauthorized("Token has expired.") from exc
    except jwt.InvalidTokenError as exc:
        raise unauthorized("Invalid token.") from exc
