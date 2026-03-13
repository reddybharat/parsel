"""
Pydantic models for the tracker. All monetary values in INR (₹).
"""

from datetime import date
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict

from tracker.constants import CATEGORIES


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in INR (must be > 0)")
    category: str = Field(..., min_length=1)
    transaction_date: date = Field(default_factory=date.today)
    description: Optional[str] = None

    @field_validator("category")
    @classmethod
    def category_must_be_allowed(cls, v: str) -> str:
        v = v.strip()
        if v not in CATEGORIES:
            raise ValueError(
                f"Invalid category. Must be one of: {', '.join(CATEGORIES)}"
            )
        return v


class TransactionUpdate(BaseModel):
    """Optional fields for PATCH; only provided fields are updated."""

    amount: Optional[float] = Field(None, gt=0, description="Amount in INR (must be > 0)")
    category: Optional[str] = None
    transaction_date: Optional[date] = None
    description: Optional[str] = None

    @field_validator("category")
    @classmethod
    def category_must_be_allowed_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is None or (isinstance(v, str) and not v.strip()):
            return v
        v = v.strip()
        if v not in CATEGORIES:
            raise ValueError(
                f"Invalid category. Must be one of: {', '.join(CATEGORIES)}"
            )
        return v


class TransactionResponse(BaseModel):
    id: str
    amount: float
    category: str
    transaction_date: date
    description: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)
