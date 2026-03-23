"""
Pydantic models for the tracker. All monetary values in INR (₹).
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict

from tracker.constants import CATEGORIES


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in INR (must be > 0)")
    category: str = Field(..., min_length=1)
    transaction_date: date = Field(default_factory=date.today)
    description: Optional[str] = None
    # When True => Debit (rendered as negative amount in UI).
    # When False => Credit (rendered as positive amount in UI).
    is_debit: bool = True

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
    is_debit: Optional[bool] = None

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
    is_debit: bool
    category: str
    transaction_date: date
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    version_no: int

    model_config = ConfigDict(from_attributes=True)


class TransactionsSearchResult(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[TransactionResponse]


class DashboardSummaryResponse(BaseModel):
    portfolio_net: float
    current_month_spend: float
    previous_month_spend: float
    spend_delta_pct: Optional[float] = None


class DashboardTrendPoint(BaseModel):
    month_label: str
    spend: float


class DashboardTrendResponse(BaseModel):
    months: int
    points: list[DashboardTrendPoint]


class DashboardRecentItem(BaseModel):
    id: str
    transaction_date: date
    category: str
    amount: float
    is_debit: bool
    description: Optional[str] = None


class DashboardRecentResponse(BaseModel):
    items: list[DashboardRecentItem]


class DashboardTopCategory(BaseModel):
    category: Optional[str] = None
    spend: float = 0.0


class DashboardHighlightsResponse(BaseModel):
    top_category: DashboardTopCategory
    total_inflow: float = 0.0
    total_outflow: float = 0.0
