from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..utils.constants import FINE_PAYMENT_MODES


class FinePaymentCreate(BaseModel):
    amount: float = Field(gt=0, le=1000000)
    payment_mode: str = Field(min_length=1, max_length=30)
    reference: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=300)

    @field_validator("payment_mode")
    @classmethod
    def validate_payment_mode(cls, value: str) -> str:
        normalized = value.strip().lower()
        if normalized not in FINE_PAYMENT_MODES:
            raise ValueError(f"payment_mode must be one of {sorted(FINE_PAYMENT_MODES)}")
        return normalized


class FinePaymentOut(BaseModel):
    id: int
    loan_id: int
    user_id: int
    amount: float
    payment_mode: str
    reference: str | None
    notes: str | None
    collected_at: datetime
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)


class FineSummaryOut(BaseModel):
    loan_id: int
    estimated_fine: float
    fine_paid: float
    fine_due: float
    payment_count: int
    is_settled: bool
