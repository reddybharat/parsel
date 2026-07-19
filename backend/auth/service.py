"""User registration and authentication."""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError

from auth.models import User
from auth.security import hash_password, verify_password
from common.database import get_connection


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


async def register_user(username: str, email: str, password: str) -> User:
    normalized_username = username.strip().lower()
    normalized_email = email.strip().lower()
    user = User(
        username=normalized_username,
        email=normalized_email,
        password_hash=hash_password(password),
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
    async with get_connection() as session:
        result = await session.execute(select(User).where(User.id == user_id))
        return result.scalar_one_or_none()
