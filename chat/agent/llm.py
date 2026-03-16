"""LLM initialization for the SQL agent."""

import os
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
