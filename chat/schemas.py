"""Pydantic models for chat API request bodies."""

from pydantic import BaseModel, Field


class ChatInvokeRequest(BaseModel):
    message: str = Field(..., min_length=1)


class ChatResumeRequest(BaseModel):
    thread_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)


class ChatExitRequest(BaseModel):
    thread_id: str = Field(..., min_length=1)
