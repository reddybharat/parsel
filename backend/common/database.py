"""
Shared SQLAlchemy async PostgreSQL engine/session utilities.
"""

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

_DATABASE_URL: str | None = None
_ASYNC_ENGINE: AsyncEngine | None = None
_SESSIONMAKER: async_sessionmaker[AsyncSession] | None = None


def get_database_url() -> str:
    """Return DATABASE_URL from environment. Raises ValueError if not set."""
    global _DATABASE_URL
    if _DATABASE_URL is None:
        _DATABASE_URL = os.getenv("DATABASE_URL")
    if not _DATABASE_URL:
        raise ValueError("DATABASE_URL must be set in .env to use database.")
    return _DATABASE_URL


def get_async_database_url() -> str:
    """Normalize DB URL for SQLAlchemy asyncpg dialect."""
    raw = get_database_url().strip()
    if raw.startswith("postgresql+asyncpg://"):
        return raw
    if raw.startswith("postgresql://"):
        return raw.replace("postgresql://", "postgresql+asyncpg://", 1)
    if raw.startswith("postgres://"):
        return raw.replace("postgres://", "postgresql+asyncpg://", 1)
    return raw


def is_database_configured() -> bool:
    """Return True if DATABASE_URL is set."""
    return bool(os.getenv("DATABASE_URL"))


def get_async_engine() -> AsyncEngine:
    global _ASYNC_ENGINE
    if _ASYNC_ENGINE is None:
        _ASYNC_ENGINE = create_async_engine(
            get_async_database_url(),
            pool_pre_ping=True,
            future=True,
        )
    return _ASYNC_ENGINE


def get_sessionmaker() -> async_sessionmaker[AsyncSession]:
    global _SESSIONMAKER
    if _SESSIONMAKER is None:
        _SESSIONMAKER = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
            autoflush=False,
        )
    return _SESSIONMAKER


@asynccontextmanager
async def get_connection() -> AsyncIterator[AsyncSession]:
    """
    Async context manager for DB session.
    Kept as `get_connection` for compatibility across existing imports.
    """
    session = get_sessionmaker()()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()
