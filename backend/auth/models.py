from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import JSON, Boolean, Integer, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from common.base import Base, UTCDateTime, UUIDText

_DEFAULT_PREFERENCES = {"theme": "light", "custom_categories": []}


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUIDText,
        primary_key=True,
        default=uuid.uuid4,
    )
    username: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    email: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    first_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_name: Mapped[str | None] = mapped_column(Text, nullable=True)
    preferences: Mapped[dict[str, Any]] = mapped_column(
        JSON,
        nullable=False,
        default=lambda: dict(_DEFAULT_PREFERENCES),
        server_default=text(
            "'{\"theme\":\"light\",\"custom_categories\":[]}'"
        ),
    )
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
    password_changed_at: Mapped[datetime] = mapped_column(
        UTCDateTime,
        nullable=False,
        server_default=func.now(),
    )
    last_login_at: Mapped[datetime | None] = mapped_column(
        UTCDateTime,
        nullable=True,
    )
    version_no: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
