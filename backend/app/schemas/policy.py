from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PolicyUpdate(BaseModel):
    enforce_limits: bool = True
    max_active_loans_per_user: int = Field(ge=1, le=50)
    max_loan_days: int = Field(ge=1, le=365)
    fine_per_day: float = Field(ge=0, le=10000)


class PolicyOut(PolicyUpdate):
    id: int
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
