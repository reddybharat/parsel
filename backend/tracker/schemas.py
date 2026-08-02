"""
Pydantic models for the tracker. All monetary values in INR (₹).
"""

from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator
from pydantic.config import ConfigDict

from tracker.constants import BANKS, CATEGORY_NAME_MAX_LENGTH, PAYMENT_METHODS
from tracker.category_service import normalize_category_name


def _validate_bank_required(v: object) -> str:
    if v is None or (isinstance(v, str) and not str(v).strip()):
        raise ValueError("Please select a bank.")
    s = str(v).strip()
    if s not in BANKS:
        raise ValueError(f"Invalid bank. Must be one of: {', '.join(BANKS)}")
    return s


def _validate_bank_optional(v: object) -> Optional[str]:
    if v is None:
        return None
    if isinstance(v, str) and not v.strip():
        raise ValueError("Please select a bank.")
    return _validate_bank_required(v)


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=CATEGORY_NAME_MAX_LENGTH)


class CategoryRename(BaseModel):
    old_name: str = Field(..., min_length=1, max_length=CATEGORY_NAME_MAX_LENGTH)
    new_name: str = Field(..., min_length=1, max_length=CATEGORY_NAME_MAX_LENGTH)


class CategoryResponse(BaseModel):
    name: str
    is_system: bool


class TransactionCreate(BaseModel):
    amount: float = Field(..., gt=0, description="Amount in INR (must be > 0)")
    category: str = Field(..., min_length=1)
    bank: str
    # Omitted or blank/null in JSON is stored as NULL when the column allows it.
    payment_method: Optional[str] = None
    transaction_date: date = Field(default_factory=date.today)
    description: Optional[str] = None
    # When True => Debit (rendered as negative amount in UI).
    # When False => Credit (rendered as positive amount in UI).
    is_debit: bool = True

    @field_validator("category", mode="before")
    @classmethod
    def category_required(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not str(v).strip()):
            raise ValueError("Please select a category.")
        s = normalize_category_name(str(v))
        if not s:
            raise ValueError("Please select a category.")
        if len(s) > CATEGORY_NAME_MAX_LENGTH:
            raise ValueError(
                f"Category name must be at most {CATEGORY_NAME_MAX_LENGTH} characters."
            )
        return s

    @field_validator("bank", mode="before")
    @classmethod
    def bank_required(cls, v: object) -> str:
        return _validate_bank_required(v)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0.")
        return v

    @field_validator("transaction_date")
    @classmethod
    def transaction_date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Transaction date cannot be in the future.")
        return v

    @field_validator("payment_method", mode="before")
    @classmethod
    def payment_method_optional(cls, v: object) -> Optional[str]:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        s = str(v).strip()
        if s not in PAYMENT_METHODS:
            raise ValueError(
                f"Invalid payment_method. Must be one of: {', '.join(PAYMENT_METHODS)}"
            )
        return s


class TransactionUpdate(BaseModel):
    """Optional fields for PATCH; only provided fields are updated."""

    amount: Optional[float] = Field(None, gt=0, description="Amount in INR (must be > 0)")
    category: Optional[str] = None
    bank: Optional[str] = None
    payment_method: Optional[str] = None
    transaction_date: Optional[date] = None
    description: Optional[str] = None
    is_debit: Optional[bool] = None

    @field_validator("category", mode="before")
    @classmethod
    def category_normalized_if_present(cls, v: object) -> Optional[str]:
        if v is None:
            return None
        if isinstance(v, str) and not v.strip():
            return None
        s = normalize_category_name(str(v))
        if not s:
            return None
        if len(s) > CATEGORY_NAME_MAX_LENGTH:
            raise ValueError(
                f"Category name must be at most {CATEGORY_NAME_MAX_LENGTH} characters."
            )
        return s

    @field_validator("bank", mode="before")
    @classmethod
    def bank_if_present(cls, v: object) -> Optional[str]:
        return _validate_bank_optional(v)

    @field_validator("payment_method")
    @classmethod
    def payment_method_must_be_allowed_if_present(cls, v: Optional[str]) -> Optional[str]:
        if v is None or (isinstance(v, str) and not v.strip()):
            return v
        v = v.strip()
        if v not in PAYMENT_METHODS:
            raise ValueError(
                f"Invalid payment_method. Must be one of: {', '.join(PAYMENT_METHODS)}"
            )
        return v

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive_if_present(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and v <= 0:
            raise ValueError("Amount must be greater than 0.")
        return v

    @field_validator("transaction_date")
    @classmethod
    def transaction_date_not_in_future_if_present(cls, v: Optional[date]) -> Optional[date]:
        if v is not None and v > date.today():
            raise ValueError("Transaction date cannot be in the future.")
        return v


class TransactionResponse(BaseModel):
    id: str
    amount: float
    is_debit: bool
    category: str
    bank: Optional[str] = None
    payment_method: Optional[str] = None
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
    bank: Optional[str] = None
    payment_method: Optional[str] = None
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
    current_month_investments: float = 0.0


class DashboardDailySpendPoint(BaseModel):
    day: int
    spend: float


class DashboardDailySpendResponse(BaseModel):
    month_label: str
    total: float
    points: list[DashboardDailySpendPoint]


class DashboardCategorySpendItem(BaseModel):
    category: str
    spend: float


class DashboardCategorySpendResponse(BaseModel):
    items: list[DashboardCategorySpendItem]


class DashboardOverviewResponse(BaseModel):
    summary: DashboardSummaryResponse
    trend: DashboardTrendResponse
    recent: DashboardRecentResponse
    highlights: DashboardHighlightsResponse
    daily_spend: DashboardDailySpendResponse
    category_spend: DashboardCategorySpendResponse


class ImportFieldIssue(BaseModel):
    field: str
    code: str
    message: str


class ImportPreviewRow(BaseModel):
    source_row: int
    transaction_date: str
    category: str
    amount: str
    is_debit: str
    bank: str
    description: Optional[str] = None
    payment_method: Optional[str] = None
    issues: list[ImportFieldIssue] = Field(default_factory=list)
    is_ready: bool = False
    category_is_new: bool = False


class ImportPreviewResponse(BaseModel):
    rows: list[ImportPreviewRow] = Field(default_factory=list)
    file_errors: list[str] = Field(default_factory=list)
    new_categories: list[str] = Field(default_factory=list)
    valid_row_count: int = 0
    errors: list[str] = Field(default_factory=list)


class ReviewedImportRow(BaseModel):
    source_row: int
    amount: float = Field(..., gt=0)
    category: str = Field(..., min_length=1)
    bank: str
    payment_method: Optional[str] = None
    transaction_date: date
    description: Optional[str] = None
    is_debit: bool = True

    @field_validator("category", mode="before")
    @classmethod
    def category_required(cls, v: object) -> str:
        if v is None or (isinstance(v, str) and not str(v).strip()):
            raise ValueError("Please select a category.")
        s = normalize_category_name(str(v))
        if not s:
            raise ValueError("Please select a category.")
        if len(s) > CATEGORY_NAME_MAX_LENGTH:
            raise ValueError(
                f"Category name must be at most {CATEGORY_NAME_MAX_LENGTH} characters."
            )
        return s

    @field_validator("bank", mode="before")
    @classmethod
    def bank_required(cls, v: object) -> str:
        return _validate_bank_required(v)

    @field_validator("amount")
    @classmethod
    def amount_must_be_positive(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Amount must be greater than 0.")
        return v

    @field_validator("transaction_date")
    @classmethod
    def transaction_date_not_in_future(cls, v: date) -> date:
        if v > date.today():
            raise ValueError("Transaction date cannot be in the future.")
        return v

    @field_validator("payment_method", mode="before")
    @classmethod
    def payment_method_optional(cls, v: object) -> Optional[str]:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        s = str(v).strip()
        if s not in PAYMENT_METHODS:
            raise ValueError(
                f"Invalid payment_method. Must be one of: {', '.join(PAYMENT_METHODS)}"
            )
        return s


class ReviewedImportRequest(BaseModel):
    rows: list[ReviewedImportRow] = Field(..., min_length=1)
    approved_new_categories: list[str] = Field(default_factory=list)


class ReviewedImportResponse(BaseModel):
    inserted: int
    created_categories: list[str] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)
