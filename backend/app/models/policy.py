from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, func, text
from sqlalchemy.orm import Mapped, mapped_column

from ..db import Base


class LibraryPolicy(Base):
    __tablename__ = "library_policies"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    enforce_limits: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )
    max_active_loans_per_user: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("5")
    )
    max_loan_days: Mapped[int] = mapped_column(
        Integer, nullable=False, server_default=text("21")
    )
    fine_per_day: Mapped[float] = mapped_column(
        Float, nullable=False, server_default=text("2.0")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
    created_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    updated_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
