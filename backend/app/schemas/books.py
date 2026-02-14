from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class BookBase(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    author: str = Field(min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=120)
    rack_number: str | None = Field(default=None, max_length=64)
    isbn: str | None = Field(default=None, max_length=32)
    published_year: int | None = Field(default=None, ge=0, le=2100)


class BookCreate(BookBase):
    copies_total: int = Field(ge=1, le=10000)


class BookUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    author: str | None = Field(default=None, min_length=1, max_length=200)
    subject: str | None = Field(default=None, max_length=120)
    rack_number: str | None = Field(default=None, max_length=64)
    isbn: str | None = Field(default=None, max_length=32)
    published_year: int | None = Field(default=None, ge=0, le=2100)
    copies_total: int | None = Field(default=None, ge=1, le=10000)


class BookOut(BookBase):
    id: int
    copies_total: int
    copies_available: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)
