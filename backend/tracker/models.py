from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import uuid

from sqlalchemy import (
    Boolean,
    Date,
    ForeignKey,
    Integer,
    Numeric,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from common.base import Base, UTCDateTime, UUIDText

# Stored as REAL; read back as a 2-dp Decimal.
_MONEY = Numeric(14, 2)


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDText,
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDText,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    is_debit: Mapped[bool] = mapped_column(Boolean, nullable=False)
    category: Mapped[str] = mapped_column(Text, nullable=False)
    payment_method: Mapped[str | None] = mapped_column(Text, nullable=True)
    bank: Mapped[str | None] = mapped_column(Text, nullable=True)
    transaction_date: Mapped[date] = mapped_column(Date, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        nullable=False,
        server_default=func.now(),
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")


class UserBank(Base):
    """A bank on a user's profile with its opening balance seed.

    Opening balance is the cash on the 1st of `opening_month`; any later month's
    closing balance is computed (opening + signed transactions), never stored.
    """

    __tablename__ = "user_banks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDText,
        primary_key=True,
        default=uuid.uuid4,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDText,
        ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    bank: Mapped[str] = mapped_column(Text, nullable=False)
    opening_balance: Mapped[Decimal] = mapped_column(_MONEY, nullable=False)
    # First day of the opening month (day is always 1).
    opening_month: Mapped[date] = mapped_column(Date, nullable=False)
    is_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True, server_default="1"
    )
    created_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        nullable=False,
        server_default=func.now(),
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")

    __table_args__ = (
        UniqueConstraint("user_id", "bank", name="uq_user_banks_user_bank"),
    )
