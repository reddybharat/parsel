"""Agent state definition."""

from typing import Annotated

from langchain_core.messages import BaseMessage
from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages


class AgentState(MessagesState):
    """Graph state: conversation history plus the owning user id."""

    messages: Annotated[list[BaseMessage], add_messages]
    user_id: str
