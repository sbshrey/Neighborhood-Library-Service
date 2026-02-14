from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


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
    model_config = ConfigDict(from_attributes=True)


class BorrowedBookOut(BaseModel):
    loan_id: int
    book_id: int
    title: str
    author: str
    borrowed_at: datetime
    due_at: datetime
