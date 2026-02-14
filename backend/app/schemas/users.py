from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from ..utils.constants import USER_ROLES


class UserBase(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    role: str = Field(default="member", max_length=30)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in USER_ROLES:
            raise ValueError(f"role must be one of {sorted(USER_ROLES)}")
        return value


class UserCreate(UserBase):
    password: str | None = Field(default=None, min_length=8, max_length=128)


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    email: str | None = Field(default=None, max_length=200)
    phone: str | None = Field(default=None, max_length=40)
    role: str | None = Field(default=None, max_length=30)
    password: str | None = Field(default=None, min_length=8, max_length=128)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str | None) -> str | None:
        if value is None:
            raise ValueError("role cannot be null")
        if value not in USER_ROLES:
            raise ValueError(f"role must be one of {sorted(USER_ROLES)}")
        return value


class UserOut(UserBase):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
