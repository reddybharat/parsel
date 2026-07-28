"""
Category helpers without a catalog table.

Known names = SYSTEM_CATEGORIES ∪ distinct transaction.category values (global).
Custom names exist only while at least one transaction uses them.
"""

from __future__ import annotations

from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import func, select, update

from common.database import get_connection
from tracker.constants import CATEGORY_NAME_MAX_LENGTH, SYSTEM_CATEGORIES
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


async def _distinct_transaction_categories() -> list[str]:
    async with get_connection() as session:
        rows = (
            await session.execute(
                select(Transaction.category)
                .where(Transaction.category.is_not(None))
                .distinct()
            )
        ).scalars().all()
    names = [str(name) for name in rows if name and str(name).strip()]
    names.sort(key=str.casefold)
    return names


async def known_category_map() -> dict[str, str]:
    """casefold key → canonical display name (system preferred over transaction spelling)."""
    mapping = _system_key_map()
    for name in await _distinct_transaction_categories():
        key = category_key(name)
        if key not in mapping:
            mapping[key] = normalize_category_name(name)
    return mapping


async def list_categories() -> list[CategoryInfo]:
    system_keys = set(_system_key_map())
    known = await known_category_map()
    items = [
        CategoryInfo(name=name, is_system=(category_key(name) in system_keys))
        for name in known.values()
    ]
    items.sort(key=lambda item: (not item.is_system, item.name.casefold()))
    return items


async def find_canonical_name(raw: str) -> str | None:
    name = validate_category_name(raw)
    known = await known_category_map()
    return known.get(category_key(name))


async def resolve_category_name(
    raw: str,
    *,
    allow_new: bool = True,
) -> str:
    """
    Return the canonical category string to store on a transaction.
    Case-insensitive match against system + existing transaction names.
    When allow_new is True, unknown names are accepted as new custom labels.
    """
    name = validate_category_name(raw)
    canonical = await find_canonical_name(name)
    if canonical is not None:
        return canonical
    if allow_new:
        return name
    raise ValueError(
        f'Unknown category "{name}". Create it from the dropdown or confirm import '
        "to add new categories."
    )


async def register_category_name(raw_name: str) -> CategoryInfo:
    """
    Validate a name for on-the-fly use. Does not persist anything —
    the name becomes part of the shared list once a transaction uses it.
    """
    name = validate_category_name(raw_name)
    canonical = await find_canonical_name(name)
    if canonical is not None:
        return CategoryInfo(
            name=canonical,
            is_system=category_key(canonical) in _system_key_map(),
        )
    return CategoryInfo(name=name, is_system=False)


async def rename_category(old_raw: str, new_raw: str) -> CategoryInfo:
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

    known = await known_category_map()
    if old_key not in known:
        raise HTTPException(status_code=404, detail="Category not found")

    canonical_old = known[old_key]
    if new_key != old_key and new_key in known:
        raise HTTPException(
            status_code=409,
            detail=f'A category named "{known[new_key]}" already exists.',
        )

    # Prefer system casing if renaming onto a system key (blocked above for old;
    # new_key in system would mean merging into system — allow only via exact key match
    # after rename of custom → would collide with system name).
    if new_key in system_keys:
        raise HTTPException(
            status_code=409,
            detail=f'A category named "{system_keys[new_key]}" already exists.',
        )

    display_new = new_name
    async with get_connection() as session:
        usage = int(
            (
                await session.execute(
                    select(func.count())
                    .select_from(Transaction)
                    .where(func.lower(Transaction.category) == old_key)
                )
            ).scalar_one()
        )
        if usage == 0:
            raise HTTPException(status_code=404, detail="Category not found")

        await session.execute(
            update(Transaction)
            .where(func.lower(Transaction.category) == old_key)
            .values(
                category=display_new,
                updated_at=func.now(),
                version_no=Transaction.version_no + 1,
            )
        )

    return CategoryInfo(name=display_new, is_system=False)


async def list_missing_category_names(names: list[str]) -> list[str]:
    """Unique display names not yet known (system or used on any transaction)."""
    known = await known_category_map()
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
