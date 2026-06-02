"""Pydantic models for chat API request bodies."""

from pydantic import BaseModel, Field, field_validator


def _strip_non_empty(value: object, *, field_label: str) -> str:
    if value is None or (isinstance(value, str) and not value.strip()):
        raise ValueError(f"{field_label} cannot be empty.")
    return str(value).strip()


class ChatInvokeRequest(BaseModel):
    message: str = Field(..., min_length=1)

    @field_validator("message", mode="before")
    @classmethod
    def message_non_empty(cls, v: object) -> str:
        return _strip_non_empty(v, field_label="Message")


class ChatResumeRequest(BaseModel):
    thread_id: str = Field(..., min_length=1)
    message: str = Field(..., min_length=1)

    @field_validator("thread_id", mode="before")
    @classmethod
    def thread_id_non_empty(cls, v: object) -> str:
        return _strip_non_empty(v, field_label="Thread ID")

    @field_validator("message", mode="before")
    @classmethod
    def message_non_empty(cls, v: object) -> str:
        return _strip_non_empty(v, field_label="Message")


class ChatExitRequest(BaseModel):
    thread_id: str = Field(..., min_length=1)

    @field_validator("thread_id", mode="before")
    @classmethod
    def thread_id_non_empty(cls, v: object) -> str:
        return _strip_non_empty(v, field_label="Thread ID")
