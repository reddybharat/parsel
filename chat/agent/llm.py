"""LLM initialization for the SQL agent."""

import os
from typing import Optional

from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

from common.logger import get_logger

load_dotenv()

logger = get_logger(__name__)

_GOOGLE_API_KEY: Optional[str] = os.getenv("GOOGLE_API_KEY")
_GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")

_llm = None


def get_llm() -> ChatGoogleGenerativeAI:
    """Return a cached Gemini LLM instance. Raises if GOOGLE_API_KEY is missing."""
    global _llm
    if _llm is not None:
        return _llm

    logger.info("Initializing Gemini LLM (model=%s)", _GEMINI_MODEL)
    if not _GOOGLE_API_KEY:
        logger.error("GOOGLE_API_KEY is not set")
        raise ValueError(
            "GOOGLE_API_KEY is not set. Add it to .env to use the Chat assistant."
        )

    _llm = ChatGoogleGenerativeAI(
        model=_GEMINI_MODEL,
        google_api_key=_GOOGLE_API_KEY,
        temperature=0,
    )
    logger.info("Gemini LLM initialized successfully")
    return _llm
