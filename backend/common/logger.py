"""
Shared logger configuration for the Personal Finance Tracker.

Usage:
    from common.logger import get_logger
    logger = get_logger(__name__)
"""

import logging
import os
import sys

_configured = False


def _get_log_level_from_env() -> int:
    """Return logging level from LOG_LEVEL env var, defaulting to INFO."""
    level_name = os.getenv("LOG_LEVEL", "INFO").upper()
    return getattr(logging, level_name, logging.INFO)


def _configure_logging() -> None:
    """Set up root logging once."""
    global _configured
    if _configured:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter("%(asctime)s | %(name)s | %(levelname)s | %(message)s")
    )

    root = logging.getLogger()
    root.setLevel(_get_log_level_from_env())
    root.addHandler(handler)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger. Configures root logging on first call."""
    _configure_logging()
    return logging.getLogger(name)
