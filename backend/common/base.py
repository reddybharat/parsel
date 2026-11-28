"""Shared SQLAlchemy declarative base and SQLite column types."""

import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import DateTime, String
from sqlalchemy.engine import Dialect
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.types import TypeDecorator

_UUID_TEXT_LENGTH = 36


class Base(DeclarativeBase):
    pass


class UUIDText(TypeDecorator[uuid.UUID]):
    """UUID stored as dashed 36-char text, so raw SQL can compare `user_id = '<uuid>'`."""

    impl = String(_UUID_TEXT_LENGTH)
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> str | None:
        if value is None:
            return None
        return str(value if isinstance(value, uuid.UUID) else uuid.UUID(str(value)))

    def process_result_value(self, value: Any, dialect: Dialect) -> uuid.UUID | None:
        return None if value is None else uuid.UUID(str(value))


class UTCDateTime(TypeDecorator[datetime]):
    """Stored as naive UTC text; returned tz-aware so clients don't read it as local time."""

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> datetime | None:
        if isinstance(value, datetime) and value.tzinfo is not None:
            return value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> datetime | None:
        return None if value is None else value.replace(tzinfo=timezone.utc)
