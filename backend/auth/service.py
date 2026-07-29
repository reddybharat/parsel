"""User registration and authentication."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from auth.models import User
from auth.security import hash_password, verify_password
from common.database import get_connection, get_readonly_connection

_DEFAULT_PREFERENCES: dict[str, Any] = {"theme": "light"}
_UNSET = object()


class EmailAlreadyRegisteredError(Exception):
    pass


class UsernameAlreadyTakenError(Exception):
    pass


class InvalidCredentialsError(Exception):
    pass


class AccountInactiveError(Exception):
    pass


def _integrity_conflict(exc: IntegrityError) -> Exception:
    detail = str(getattr(exc, "orig", exc)).lower()
    if "username" in detail:
        return UsernameAlreadyTakenError("Username is already taken.")
    if "email" in detail:
        return EmailAlreadyRegisteredError("Email is already registered.")
    return EmailAlreadyRegisteredError("Account already exists.")


def _merge_preferences(
    existing: dict[str, Any] | None,
    patch: dict[str, Any] | None,
) -> dict[str, Any]:
    merged = dict(_DEFAULT_PREFERENCES)
    if isinstance(existing, dict):
        merged.update(existing)
    if isinstance(patch, dict):
        merged.update(patch)
    return merged


async def register_user(username: str, email: str, password: str) -> User:
    normalized_username = username.strip().lower()
    normalized_email = email.strip().lower()
    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(password),
        preferences=dict(_DEFAULT_PREFERENCES),
    )
    try:
        async with get_connection() as session:
            existing = await session.execute(
                select(User).where(
                    or_(
                        User.username == normalized_username,
                        User.email == normalized_email,
                    )
                )
            )
            conflict = existing.scalar_one_or_none()
            if conflict is not None:
                if conflict.username == normalized_username:
                    raise UsernameAlreadyTakenError("Username is already taken.")
                raise EmailAlreadyRegisteredError("Email is already registered.")

            session.add(user)
            await session.flush()
            await session.refresh(user)
            return user
    except IntegrityError as exc:
        raise _integrity_conflict(exc) from exc


async def authenticate_user(login: str, password: str) -> User:
    """Authenticate by username or email (case-insensitive) plus password."""
    normalized = login.strip().lower()
    async with get_connection() as session:
        result = await session.execute(
            select(User).where(
                or_(User.username == normalized, User.email == normalized)
            )
        )
        user = result.scalar_one_or_none()
        if user is None or not verify_password(password, user.password_hash):
            raise InvalidCredentialsError("Invalid username/email or password.")
        if not user.is_active:
            raise AccountInactiveError("Account is disabled.")
        user.last_login_at = func.now()
        await session.flush()
        await session.refresh(user)
        return user


async def get_user_by_id(user_id: uuid.UUID) -> User | None:
    async with get_readonly_connection() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()


async def update_me(
    user_id: uuid.UUID,
    *,
    username: str | None = None,
    first_name: Any = _UNSET,
    last_name: Any = _UNSET,
    preferences: dict[str, Any] | None = None,
) -> User:
    """Update profile fields. Names use _UNSET to mean leave unchanged."""
    try:
        async with get_connection() as session:
            result = await session.execute(select(User).where(User.id == user_id))
            user = result.scalar_one_or_none()
            if user is None:
                raise AccountInactiveError("Account not found.")

            if username is not None and username != user.username:
                taken = await session.execute(
                    select(User).where(
                        User.username == username,
                        User.id != user_id,
                    )
                )
                if taken.scalar_one_or_none() is not None:
                    raise UsernameAlreadyTakenError("Username is already taken.")
                user.username = username

            if first_name is not _UNSET:
                user.first_name = first_name
            if last_name is not _UNSET:
                user.last_name = last_name
            if preferences is not None:
                user.preferences = _merge_preferences(user.preferences, preferences)

            user.updated_at = datetime.now(timezone.utc)
            user.version_no = int(user.version_no or 0) + 1
            await session.flush()
            await session.refresh(user)
            return user
    except IntegrityError as exc:
        raise _integrity_conflict(exc) from exc
