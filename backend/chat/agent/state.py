"""Agent state definition."""

from typing import Annotated

from langgraph.graph import MessagesState
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class AgentState(MessagesState):
    """Graph state carrying the conversation message history.

    The `messages` key uses the add_messages reducer so each node
    can append new messages without overwriting existing ones.
    """

    messages: Annotated[list[BaseMessage], add_messages]
