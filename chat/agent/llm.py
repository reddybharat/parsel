"""LLM initialization for the SQL agent."""

import asyncio
import os
import random

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_groq import ChatGroq

from common.logger import get_logger

logger = get_logger(__name__)


def get_llm() -> ChatGroq:
    """Return a Groq chat model. Raises if GROQ_API_KEY is missing.

    Reads GROQ_API_KEY (and optional GROQ_MODEL) lazily at call time so that
    load_dotenv() has already populated the environment.
    """

    groq_api_key = os.getenv("GROQ_API_KEY")
    groq_model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

    logger.info("Initializing Groq LLM (model=%s)", groq_model)
    if not groq_api_key:
        logger.error("GROQ_API_KEY is not set")
        raise ValueError(
            "GROQ_API_KEY is not set. Add it to .env to use the Chat assistant."
        )

    _llm = ChatGroq(
        model=groq_model,
        groq_api_key=groq_api_key,
        temperature=0,
    )
    logger.info("Groq LLM initialized successfully")
    return _llm


def _is_retryable_llm_error(error: Exception) -> bool:
    """Return True for transient provider/API failures (429/5xx)."""
    text = str(error).lower()
    # Quota exhaustion (daily/project limits) is not transient in-request.
    # Retrying immediately only creates repeated API traffic.
    non_retryable_quota_markers = (
        "quota exceeded for metric",
        "check your plan and billing",
        "perday",
        "free_tier_requests",
        "daily limit",
    )
    if any(marker in text for marker in non_retryable_quota_markers):
        return False

    status_code = getattr(error, "status_code", None)
    if isinstance(status_code, int) and (status_code == 429 or 500 <= status_code < 600):
        return True

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
    llm: BaseChatModel,
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
