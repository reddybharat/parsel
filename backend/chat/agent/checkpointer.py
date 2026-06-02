"""Process-wide LangGraph checkpointer for chat thread memory."""

from langgraph.checkpoint.memory import MemorySaver

_checkpointer: MemorySaver | None = None


def get_checkpointer() -> MemorySaver:
    """Return the shared in-memory checkpointer (one per API process)."""
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = MemorySaver()
    return _checkpointer
