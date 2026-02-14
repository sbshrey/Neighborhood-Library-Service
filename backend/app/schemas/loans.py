from datetime import datetime
from datetime import timezone

from pydantic import BaseModel, ConfigDict, Field, model_validator

from ..config import settings


class LoanCreate(BaseModel):
    book_id: int
    user_id: int
    days: int = Field(default=14, ge=1, le=365)


class LoanUpdate(BaseModel):
    extend_days: int = Field(default=7, ge=1, le=365)


class LoanOut(BaseModel):
    id: int
    book_id: int
    user_id: int
    borrowed_at: datetime
    due_at: datetime
    returned_at: datetime | None
    is_overdue: bool = False
    overdue_days: int = 0
    estimated_fine: float = 0.0
    fine_paid: float = 0.0
    fine_due: float = 0.0
    is_fine_settled: bool = False
    model_config = ConfigDict(from_attributes=True)

    @staticmethod
    def _to_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)

    @model_validator(mode="after")
    def compute_overdue(self) -> "LoanOut":
        now = datetime.now(timezone.utc)
        due = self._to_utc(self.due_at)
        reference = self._to_utc(self.returned_at) if self.returned_at else now
        overdue_days = max(0, (reference.date() - due.date()).days)
        self.overdue_days = overdue_days
        self.estimated_fine = round(overdue_days * settings.overdue_fine_per_day, 2)
        self.fine_due = round(max(self.estimated_fine - float(self.fine_paid or 0.0), 0.0), 2)
        self.is_fine_settled = self.estimated_fine > 0 and self.fine_due <= 0
        self.is_overdue = self.returned_at is None and overdue_days > 0
        return self


class BorrowedBookOut(BaseModel):
    loan_id: int
    book_id: int
    title: str
    author: str
    borrowed_at: datetime
    due_at: datetime


class UserLoanOut(LoanOut):
    book_title: str
    book_author: str
    book_isbn: str | None = None
