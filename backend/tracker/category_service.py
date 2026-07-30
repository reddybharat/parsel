"""User-scoped custom categories stored in user preferences."""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy import func, select, update

from auth.models import User
from common.database import get_connection, get_readonly_connection
from tracker.constants import (
    CATEGORY_NAME_MAX_LENGTH,
    MAX_CUSTOM_CATEGORIES,
    SYSTEM_CATEGORIES,
)
from tracker.models import Transaction


@dataclass(frozen=True)
class CategoryInfo:
    name: str
    is_system: bool


def normalize_category_name(raw: str) -> str:
    return " ".join(str(raw).split()).strip()


def category_key(name: str) -> str:
    return normalize_category_name(name).casefold()


def validate_category_name(raw: object) -> str:
    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        raise ValueError("Please enter a category name.")
    name = normalize_category_name(str(raw))
    if not name:
        raise ValueError("Please enter a category name.")
    if len(name) > CATEGORY_NAME_MAX_LENGTH:
        raise ValueError(
            f"Category name must be at most {CATEGORY_NAME_MAX_LENGTH} characters."
        )
    return name


def _system_key_map() -> dict[str, str]:
    return {category_key(name): name for name in SYSTEM_CATEGORIES}


def _custom_categories_from_preferences(
    preferences: dict[str, Any] | None,
) -> list[str]:
    raw_categories = (
        preferences.get("custom_categories", [])
        if isinstance(preferences, dict)
        else []
    )
    if not isinstance(raw_categories, list):
        return []

    system_keys = set(_system_key_map())
    categories: list[str] = []
    seen: set[str] = set()
    for raw in raw_categories:
        try:
            name = validate_category_name(raw)
        except ValueError:
            continue
        key = category_key(name)
        if key in system_keys or key in seen:
            continue
        seen.add(key)
        categories.append(name)
        if len(categories) == MAX_CUSTOM_CATEGORIES:
            break
    return categories


async def _load_custom_categories(user_id: uuid.UUID) -> list[str]:
    async with get_readonly_connection() as session:
        preferences = (
            await session.execute(
                select(User.preferences).where(User.id == user_id)
            )
        ).scalar_one_or_none()
    return _custom_categories_from_preferences(preferences)


async def known_category_map(user_id: uuid.UUID) -> dict[str, str]:
    """Return casefold key → canonical display name for one user."""
    mapping = _system_key_map()
    for name in await _load_custom_categories(user_id):
        key = category_key(name)
        if key not in mapping:
            mapping[key] = name
    return mapping


async def list_categories(user_id: uuid.UUID) -> list[CategoryInfo]:
    system_keys = set(_system_key_map())
    known = await known_category_map(user_id)
    items = [
        CategoryInfo(name=name, is_system=(category_key(name) in system_keys))
        for name in known.values()
    ]
    items.sort(key=lambda item: (not item.is_system, item.name.casefold()))
    return items


async def find_canonical_name(user_id: uuid.UUID, raw: str) -> str | None:
    name = validate_category_name(raw)
    known = await known_category_map(user_id)
    return known.get(category_key(name))


async def register_category_names(
    user_id: uuid.UUID,
    raw_names: list[str],
) -> list[CategoryInfo]:
    """Atomically register names in one user's preferences."""
    names: list[str] = []
    seen: set[str] = set()
    for raw in raw_names:
        name = validate_category_name(raw)
        key = category_key(name)
        if key not in seen:
            names.append(name)
            seen.add(key)

    if not names:
        return []

    async with get_connection() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()
        if user is None:
            raise ValueError("Account not found.")

        custom_categories = _custom_categories_from_preferences(user.preferences)
        known = _system_key_map()
        known.update({category_key(name): name for name in custom_categories})
        results: list[CategoryInfo] = []
        changed = False

        for name in names:
            key = category_key(name)
            canonical = known.get(key)
            if canonical is not None:
                results.append(
                    CategoryInfo(name=canonical, is_system=key in _system_key_map())
                )
                continue
            if len(custom_categories) >= MAX_CUSTOM_CATEGORIES:
                raise ValueError(
                    f"You can create up to {MAX_CUSTOM_CATEGORIES} custom categories."
                )
            custom_categories.append(name)
            known[key] = name
            results.append(CategoryInfo(name=name, is_system=False))
            changed = True

        if changed:
            preferences = dict(user.preferences or {})
            preferences["custom_categories"] = custom_categories
            user.preferences = preferences
            user.updated_at = datetime.now(timezone.utc)
            user.version_no = int(user.version_no or 0) + 1

    return results


async def resolve_category_name(
    user_id: uuid.UUID,
    raw: str,
    *,
    allow_new: bool = True,
) -> str:
    """
    Return the canonical category string to store on a transaction.
    Case-insensitive match against system + the user's custom category names.
    When allow_new is True, unknown names are registered in user preferences.
    """
    name = validate_category_name(raw)
    canonical = await find_canonical_name(user_id, name)
    if canonical is not None:
        return canonical
    if allow_new:
        registered = await register_category_names(user_id, [name])
        return registered[0].name
    raise ValueError(
        f'Unknown category "{name}". Create it from the dropdown or confirm import '
        "to add new categories."
    )


async def register_category_name(
    user_id: uuid.UUID,
    raw_name: str,
) -> CategoryInfo:
    return (await register_category_names(user_id, [raw_name]))[0]


async def rename_category(
    user_id: uuid.UUID,
    old_raw: str,
    new_raw: str,
) -> CategoryInfo:
    old_name = validate_category_name(old_raw)
    new_name = validate_category_name(new_raw)
    old_key = category_key(old_name)
    new_key = category_key(new_name)
    system_keys = _system_key_map()

    if old_key in system_keys:
        raise HTTPException(
            status_code=400,
            detail="System categories cannot be renamed.",
        )

    if new_key in system_keys:
        raise HTTPException(
            status_code=409,
            detail=f'A category named "{system_keys[new_key]}" already exists.',
        )

    display_new = new_name
    async with get_connection() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="Category not found")

        custom_categories = _custom_categories_from_preferences(user.preferences)
        custom_by_key = {
            category_key(category): category for category in custom_categories
        }
        if old_key not in custom_by_key:
            raise HTTPException(status_code=404, detail="Category not found")
        if new_key != old_key and new_key in custom_by_key:
            raise HTTPException(
                status_code=409,
                detail=f'A category named "{custom_by_key[new_key]}" already exists.',
            )

        custom_categories = [
            display_new if category_key(category) == old_key else category
            for category in custom_categories
        ]
        preferences = dict(user.preferences or {})
        preferences["custom_categories"] = custom_categories
        user.preferences = preferences
        user.updated_at = datetime.now(timezone.utc)
        user.version_no = int(user.version_no or 0) + 1

        await session.execute(
            update(Transaction)
            .where(
                Transaction.user_id == user_id,
                func.lower(Transaction.category) == old_key,
            )
            .values(
                category=display_new,
                updated_at=func.now(),
                version_no=Transaction.version_no + 1,
            )
        )

    return CategoryInfo(name=display_new, is_system=False)


async def delete_category(user_id: uuid.UUID, raw_name: str) -> None:
    """Delete an unused custom category from one user's preferences."""
    name = validate_category_name(raw_name)
    key = category_key(name)
    if key in _system_key_map():
        raise HTTPException(
            status_code=400,
            detail="System categories cannot be deleted.",
        )

    async with get_connection() as session:
        user = (
            await session.execute(
                select(User).where(User.id == user_id).with_for_update()
            )
        ).scalar_one_or_none()
        if user is None:
            raise HTTPException(status_code=404, detail="Category not found")

        custom_categories = _custom_categories_from_preferences(user.preferences)
        if key not in {category_key(category) for category in custom_categories}:
            raise HTTPException(status_code=404, detail="Category not found")

        usage = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(Transaction)
                    .where(
                        Transaction.user_id == user_id,
                        func.lower(Transaction.category) == key,
                    )
                )
            ).scalar_one()
        )
        if usage > 0:
            raise HTTPException(
                status_code=409,
                detail=(
                    f'Category "{name}" is used by {usage} '
                    f'{"transaction" if usage == 1 else "transactions"}. '
                    "Reassign or delete them first."
                ),
            )

        preferences = dict(user.preferences or {})
        preferences["custom_categories"] = [
            category
            for category in custom_categories
            if category_key(category) != key
        ]
        user.preferences = preferences
        user.updated_at = datetime.now(timezone.utc)
        user.version_no = int(user.version_no or 0) + 1


async def list_missing_category_names(
    user_id: uuid.UUID,
    names: list[str],
) -> list[str]:
    """Return unique names not yet known to one user."""
    known = await known_category_map(user_id)
    missing: list[str] = []
    seen: set[str] = set()
    for raw in names:
        try:
            name = validate_category_name(raw)
        except ValueError:
            continue
        key = category_key(name)
        if key in seen:
            continue
        seen.add(key)
        if key not in known:
            missing.append(name)
    return missing
