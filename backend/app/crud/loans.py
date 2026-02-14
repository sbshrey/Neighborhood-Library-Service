from datetime import datetime, timedelta, timezone

from sqlalchemy import func, update, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Book, Loan, User
from ..schemas.loans import LoanCreate, LoanUpdate


class CRUDLoan:
    async def _active_loans_count(self, db: AsyncSession, user_id: int) -> int:
        return await db.scalar(
            select(func.count(Loan.id)).where(Loan.user_id == user_id, Loan.returned_at.is_(None))
        )

    async def borrow(self, db: AsyncSession, payload: LoanCreate) -> Loan:
        if payload.days > settings.circulation_max_loan_days:
            raise ValueError(
                f"Loan days cannot exceed {settings.circulation_max_loan_days} days"
            )

        user = await db.get(User, payload.user_id)
        if not user:
            raise ValueError("User not found")

        active_loans = await self._active_loans_count(db, payload.user_id)
        if active_loans >= settings.circulation_max_active_loans_per_user:
            raise ValueError(
                "User has reached the maximum active loans limit "
                f"({settings.circulation_max_active_loans_per_user})"
            )

        now = datetime.now(timezone.utc)
        due_at = now + timedelta(days=payload.days)

        result = await db.execute(
            update(Book)
            .where(Book.id == payload.book_id, Book.copies_available > 0)
            .values(copies_available=Book.copies_available - 1)
        )
        if result.rowcount == 0:
            book = await db.get(Book, payload.book_id)
            if not book:
                raise ValueError("Book not found")
            raise ValueError("Book is not currently available")

        loan = Loan(book_id=payload.book_id, user_id=user.id, due_at=due_at)
        db.add(loan)
        await db.flush()
        await db.refresh(loan)
        return loan

    async def return_loan(self, db: AsyncSession, loan_id: int) -> Loan:
        now = datetime.now(timezone.utc)

        result = await db.execute(
            update(Loan)
            .where(Loan.id == loan_id, Loan.returned_at.is_(None))
            .values(returned_at=now)
        )
        if result.rowcount == 0:
            loan = await db.get(Loan, loan_id)
            if not loan:
                raise ValueError("Loan not found")
            raise ValueError("Loan already returned")

        book_id = (
            await db.execute(select(Loan.book_id).where(Loan.id == loan_id))
        ).scalar_one()
        await db.execute(
            update(Book)
            .where(Book.id == book_id)
            .values(copies_available=Book.copies_available + 1)
        )
        await db.flush()

        loan = await db.get(Loan, loan_id)
        if loan is None:
            raise ValueError("Loan not found")
        await db.refresh(loan)
        return loan

    async def list(
        self,
        db: AsyncSession,
        *,
        active: bool | None,
        user_id: int | None,
        book_id: int | None,
        overdue_only: bool,
    ):
        stmt = select(Loan)
        if active is True:
            stmt = stmt.where(Loan.returned_at.is_(None))
        if active is False:
            stmt = stmt.where(Loan.returned_at.is_not(None))
        if user_id is not None:
            stmt = stmt.where(Loan.user_id == user_id)
        if book_id is not None:
            stmt = stmt.where(Loan.book_id == book_id)
        if overdue_only:
            stmt = stmt.where(
                Loan.returned_at.is_(None),
                Loan.due_at < datetime.now(timezone.utc),
            )
        stmt = stmt.order_by(Loan.borrowed_at.desc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def update(self, db: AsyncSession, loan_id: int, payload: LoanUpdate) -> Loan:
        loan = await db.get(Loan, loan_id)
        if not loan:
            raise ValueError("Loan not found")
        if loan.returned_at is not None:
            raise ValueError("Returned loan cannot be edited")

        due_at = loan.due_at + timedelta(days=payload.extend_days)
        max_due = loan.borrowed_at + timedelta(days=settings.circulation_max_loan_days)
        if due_at > max_due:
            raise ValueError(
                "Loan extension exceeds allowed circulation window "
                f"({settings.circulation_max_loan_days} days)"
            )

        loan.due_at = due_at
        await db.flush()
        await db.refresh(loan)
        return loan

    async def remove(self, db: AsyncSession, loan_id: int) -> None:
        loan = await db.get(Loan, loan_id)
        if not loan:
            raise ValueError("Loan not found")

        if loan.returned_at is None:
            await db.execute(
                update(Book)
                .where(Book.id == loan.book_id)
                .values(copies_available=Book.copies_available + 1)
            )

        await db.delete(loan)
        await db.flush()


crud_loans = CRUDLoan()
