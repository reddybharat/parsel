"""Per-user bank profiles: opening balance seeds + active/inactive state.

The dashboard "Net Portfolio Balance" is derived from these seeds (opening
balance on the 1st of `opening_month`) plus the signed sum of transactions, so
this module is the single source of truth for which banks a user tracks.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation

from fastapi import HTTPException
from sqlalchemy import func, select

from common.database import get_connection, get_readonly_connection
from tracker.constants import BANKS
from tracker.models import Transaction, UserBank


@dataclass(frozen=True)
class UserBankInfo:
    bank: str
    opening_balance: float
    opening_month: str  # "YYYY-MM"
    is_active: bool


def _format_month(value: date) -> str:
    return f"{value.year:04d}-{value.month:02d}"


def validate_bank_name(raw: object) -> str:
    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        raise ValueError("Please select a bank.")
    name = str(raw).strip()
    if name not in BANKS:
        raise ValueError(f"Invalid bank. Must be one of: {', '.join(BANKS)}")
    return name


def parse_opening_month(raw: object) -> date:
    """Parse ``YYYY-MM`` into the first day of that month."""
    if raw is None or not str(raw).strip():
        raise ValueError("Please choose an opening month (YYYY-MM).")
    text_value = str(raw).strip()
    try:
        year_s, month_s = text_value.split("-", 1)
        year = int(year_s)
        month = int(month_s)
        if month < 1 or month > 12:
            raise ValueError
        return date(year, month, 1)
    except (TypeError, ValueError) as exc:
        raise ValueError("Opening month must be YYYY-MM.") from exc


def validate_opening_balance(raw: object) -> Decimal:
    if raw is None or (isinstance(raw, str) and not str(raw).strip()):
        raise ValueError("Please enter an opening balance.")
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, TypeError) as exc:
        raise ValueError("Opening balance must be a number.") from exc
    if value < 0:
        raise ValueError("Opening balance cannot be negative.")
    return value


def _to_info(row: UserBank) -> UserBankInfo:
    return UserBankInfo(
        bank=row.bank,
        opening_balance=float(row.opening_balance),
        opening_month=_format_month(row.opening_month),
        is_active=bool(row.is_active),
    )


def _bank_sort_key(bank: str) -> int:
    return BANKS.index(bank) if bank in BANKS else len(BANKS)


async def list_user_banks(user_id: uuid.UUID) -> list[UserBankInfo]:
    """All profile banks (active + inactive), in catalog order."""
    async with get_readonly_connection() as session:
        rows = (
            await session.execute(
                select(UserBank).where(UserBank.user_id == user_id)
            )
        ).scalars().all()
    infos = [_to_info(row) for row in rows]
    infos.sort(key=lambda item: _bank_sort_key(item.bank))
    return infos


async def list_active_bank_names(user_id: uuid.UUID) -> list[str]:
    """Active profile bank names, in catalog order (used for entry dropdowns)."""
    return [b.bank for b in await list_user_banks(user_id) if b.is_active]


async def list_profile_bank_names(user_id: uuid.UUID) -> list[str]:
    """All profile bank names (active + inactive), in catalog order."""
    return [b.bank for b in await list_user_banks(user_id)]


async def has_active_bank(user_id: uuid.UUID) -> bool:
    async with get_readonly_connection() as session:
        found = (
            await session.execute(
                select(UserBank.id)
                .where(UserBank.user_id == user_id, UserBank.is_active.is_(True))
                .limit(1)
            )
        ).first()
    return found is not None


async def list_unregistered_transaction_banks(user_id: uuid.UUID) -> list[str]:
    """Banks present on the user's transactions but not yet on their profile.

    Drives the soft-migrate suggestions on the onboarding setup screen.
    """
    async with get_readonly_connection() as session:
        txn_banks = {
            str(row[0])
            for row in (
                await session.execute(
                    select(Transaction.bank)
                    .where(
                        Transaction.user_id == user_id,
                        Transaction.bank.is_not(None),
                        func.btrim(Transaction.bank) != "",
                    )
                    .distinct()
                )
            ).all()
            if row[0]
        }
        profile_banks = {
            str(row[0])
            for row in (
                await session.execute(
                    select(UserBank.bank).where(UserBank.user_id == user_id)
                )
            ).all()
        }
    suggestions = [b for b in txn_banks - profile_banks if b in BANKS]
    suggestions.sort(key=_bank_sort_key)
    return suggestions


async def assert_bank_on_profile(user_id: uuid.UUID, bank: object) -> str:
    """Validate a bank is on the user's profile (active or inactive).

    Used when editing existing transactions: history on a now-inactive bank must
    remain editable, but you still cannot assign a bank the user never added.
    """
    name = validate_bank_name(bank)
    profile = set(await list_profile_bank_names(user_id))
    if name not in profile:
        raise ValueError(
            f'"{name}" is not a bank on your profile. Add it in Settings first.'
        )
    return name


async def assert_bank_writable(user_id: uuid.UUID, bank: object) -> str:
    """Validate a transaction bank against the user's *active* profile banks.

    Raises ValueError (surfaced as HTTP 400) when the bank is unknown, inactive,
    or not on the profile — new transactions must target an active profile bank.
    """
    name = validate_bank_name(bank)
    active = set(await list_active_bank_names(user_id))
    if name not in active:
        raise ValueError(
            f'"{name}" is not an active bank on your profile. '
            "Add or activate it in Settings before adding transactions for it."
        )
    return name


async def add_user_bank(
    user_id: uuid.UUID,
    *,
    bank: object,
    opening_balance: object,
    opening_month: object,
) -> UserBankInfo:
    name = validate_bank_name(bank)
    balance = validate_opening_balance(opening_balance)
    month_start = parse_opening_month(opening_month)

    async with get_connection() as session:
        existing = (
            await session.execute(
                select(UserBank).where(
                    UserBank.user_id == user_id, UserBank.bank == name
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            raise HTTPException(
                status_code=409,
                detail=f'"{name}" is already on your profile.',
            )
        row = UserBank(
            user_id=user_id,
            bank=name,
            opening_balance=balance,
            opening_month=month_start,
            is_active=True,
        )
        session.add(row)
        await session.flush()
        info = _to_info(row)
    return info


async def update_user_bank(
    user_id: uuid.UUID,
    bank: object,
    *,
    opening_balance: object | None = None,
    opening_month: object | None = None,
    is_active: bool | None = None,
) -> UserBankInfo:
    name = validate_bank_name(bank)
    new_balance = (
        validate_opening_balance(opening_balance)
        if opening_balance is not None
        else None
    )
    new_month = (
        parse_opening_month(opening_month) if opening_month is not None else None
    )

    async with get_connection() as session:
        row = (
            await session.execute(
                select(UserBank)
                .where(UserBank.user_id == user_id, UserBank.bank == name)
                .with_for_update()
            )
        ).scalar_one_or_none()
        if row is None:
            raise HTTPException(status_code=404, detail="Bank not found on your profile.")

        if is_active is False and bool(row.is_active):
            active_count = int(
                (
                    await session.execute(
                        select(func.count())
                        .select_from(UserBank)
                        .where(
                            UserBank.user_id == user_id,
                            UserBank.is_active.is_(True),
                        )
                    )
                ).scalar_one()
            )
            if active_count <= 1:
                raise HTTPException(
                    status_code=409,
                    detail="You must keep at least one active bank.",
                )

        if new_balance is not None:
            row.opening_balance = new_balance
        if new_month is not None:
            row.opening_month = new_month
        if is_active is not None:
            row.is_active = bool(is_active)
        row.updated_at = datetime.now(timezone.utc)
        row.version_no = int(row.version_no or 0) + 1
        info = _to_info(row)
    return info
