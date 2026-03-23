"""LLM initialization for the SQL agent."""

import asyncio
import os
import random
from typing import Optional

from langchain_google_genai import ChatGoogleGenerativeAI

from common.logger import get_logger

logger = get_logger(__name__)

_llm: Optional[ChatGoogleGenerativeAI] = None


def get_llm() -> ChatGoogleGenerativeAI:
    """Return a cached Gemini LLM instance. Raises if GOOGLE_API_KEY is missing.

    Reads GOOGLE_API_KEY lazily at call time so that load_dotenv() has already
    populated the environment (avoids capturing None at import time).
    """
    global _llm
    if _llm is not None:
        return _llm

    google_api_key = os.getenv("GOOGLE_API_KEY")
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

    logger.info("Initializing Gemini LLM (model=%s)", gemini_model)
    if not google_api_key:
        logger.error("GOOGLE_API_KEY is not set")
        raise ValueError(
            "GOOGLE_API_KEY is not set. Add it to .env to use the Chat assistant."
        )

    _llm = ChatGoogleGenerativeAI(
        model=gemini_model,
        google_api_key=google_api_key,
        temperature=0,
    )
    logger.info("Gemini LLM initialized successfully")
    return _llm


def _is_retryable_llm_error(error: Exception) -> bool:
    """Return True for transient provider/API failures (429/5xx)."""
    status_code = getattr(error, "status_code", None)
    if isinstance(status_code, int) and (status_code == 429 or 500 <= status_code < 600):
        return True

    text = str(error).lower()
    retryable_markers = (
        "429",
        "too many requests",
        "rate limit",
        "resource exhausted",
        "quota",
        "500",
        "502",
        "503",
        "504",
        "internal server error",
        "service unavailable",
        "gateway timeout",
    )
    return any(marker in text for marker in retryable_markers)


async def ainvoke_with_retry(
    llm: ChatGoogleGenerativeAI,
    prompt: str,
    max_attempts: int = 4,
    base_delay_seconds: float = 0.75,
) -> object:
    """Invoke LLM asynchronously with retry for transient 429/5xx failures."""
    last_error: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            return await llm.ainvoke(prompt)
        except Exception as e:  # noqa: BLE001
            last_error = e
            if not _is_retryable_llm_error(e) or attempt == max_attempts:
                raise

            # Exponential backoff with jitter to smooth bursts across requests.
            delay = base_delay_seconds * (2 ** (attempt - 1)) + random.uniform(0, 0.4)
            logger.warning(
                "Transient LLM error on attempt %d/%d. Retrying in %.2fs: %s",
                attempt,
                max_attempts,
                delay,
                e,
            )
            await asyncio.sleep(delay)

    # Defensive fallback; loop should either return or raise.
    if last_error is not None:
        raise last_error
    raise RuntimeError("Unexpected LLM invocation failure without exception.")
