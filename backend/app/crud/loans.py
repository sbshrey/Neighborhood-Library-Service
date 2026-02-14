from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Book, LibraryPolicy, Loan, User
from ..schemas.loans import LoanCreate, LoanUpdate
from ..utils.audit_fields import stamp_created_updated_by
from ..utils.request_context import get_actor_user_id
from .base import SQLQueryRunner
from .fine_payments import crud_fine_payments
from .policies import crud_policies


class CRUDLoan(SQLQueryRunner):
    async def count_all(self, db: AsyncSession) -> int:
        return int(await self.scalar(db, select(func.count(Loan.id)), default=0))

    async def get(self, db: AsyncSession, loan_id: int) -> Loan | None:
        return await db.get(Loan, loan_id)

    async def find_by_signature(
        self,
        db: AsyncSession,
        *,
        book_id: int,
        user_id: int,
        borrowed_at: datetime,
        due_at: datetime,
    ) -> Loan | None:
        return await self.scalar_one_or_none(
            db,
            select(Loan).where(
                Loan.book_id == book_id,
                Loan.user_id == user_id,
                Loan.borrowed_at == borrowed_at,
                Loan.due_at == due_at,
            ),
        )

    async def _get_policy(self, db: AsyncSession) -> LibraryPolicy:
        return await crud_policies.get_or_create(db)

    async def _user_with_active_loans(self, db: AsyncSession, user_id: int) -> tuple[User | None, int]:
        stmt = (
            select(User, func.count(Loan.id))
            .outerjoin(Loan, (Loan.user_id == User.id) & (Loan.returned_at.is_(None)))
            .where(User.id == user_id)
            .group_by(User.id)
        )
        row = await self.first_row(db, stmt)
        if not row:
            return None, 0
        return row[0], int(row[1] or 0)

    async def borrow(self, db: AsyncSession, payload: LoanCreate) -> Loan:
        policy = await self._get_policy(db)
        if policy.enforce_limits and payload.days > policy.max_loan_days:
            raise ValueError(f"Loan days cannot exceed {policy.max_loan_days} days")

        user, active_loans = await self._user_with_active_loans(db, payload.user_id)
        if not user:
            raise ValueError("User not found")

        if policy.enforce_limits and active_loans >= policy.max_active_loans_per_user:
            raise ValueError(
                "User has reached the maximum active loans limit "
                f"({policy.max_active_loans_per_user})"
            )

        now = datetime.now(timezone.utc)
        due_at = now + timedelta(days=payload.days)

        result = await self.execute(
            db,
            update(Book)
            .where(Book.id == payload.book_id, Book.copies_available > 0)
            .values(copies_available=Book.copies_available - 1),
        )
        if result.rowcount == 0:
            book = await db.get(Book, payload.book_id)
            if not book:
                raise ValueError("Book not found")
            raise ValueError("Book is not currently available")

        loan = Loan(book_id=payload.book_id, user_id=user.id, due_at=due_at)
        stamp_created_updated_by(loan, is_create=True)
        db.add(loan)
        await db.flush()
        await db.refresh(loan)
        return loan

    async def return_loan(self, db: AsyncSession, loan_id: int) -> Loan:
        now = datetime.now(timezone.utc)
        actor_user_id = get_actor_user_id()
        update_values: dict[str, object] = {"returned_at": now}
        if actor_user_id is not None:
            update_values["updated_by"] = actor_user_id

        result = await self.execute(
            db,
            update(Loan)
            .where(Loan.id == loan_id, Loan.returned_at.is_(None))
            .values(**update_values)
            .returning(Loan.book_id),
        )
        returned = result.first()
        if not returned:
            loan = await db.get(Loan, loan_id)
            if not loan:
                raise ValueError("Loan not found")
            raise ValueError("Loan already returned")

        book_id = int(returned[0])
        await self.execute(
            db,
            update(Book).where(Book.id == book_id).values(copies_available=Book.copies_available + 1),
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
    ) -> list[Loan]:
        await self._get_policy(db)
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
            stmt = stmt.where(Loan.returned_at.is_(None), Loan.due_at < datetime.now(timezone.utc))
        stmt = stmt.order_by(Loan.borrowed_at.desc())
        loans = await self.scalars_all(db, stmt)
        loan_ids = [loan.id for loan in loans]
        paid_map = await crud_fine_payments.paid_amounts_by_loans(db, loan_ids)
        for loan in loans:
            loan.fine_paid = paid_map.get(loan.id, 0.0)
        return loans

    async def update(self, db: AsyncSession, loan_id: int, payload: LoanUpdate) -> Loan:
        policy = await self._get_policy(db)
        loan = await db.get(Loan, loan_id)
        if not loan:
            raise ValueError("Loan not found")
        if loan.returned_at is not None:
            raise ValueError("Returned loan cannot be edited")

        due_at = loan.due_at + timedelta(days=payload.extend_days)
        max_allowed_days = policy.max_loan_days if policy.enforce_limits else 365
        max_due = loan.borrowed_at + timedelta(days=max_allowed_days)
        if policy.enforce_limits and due_at > max_due:
            raise ValueError(
                "Loan extension exceeds allowed circulation window "
                f"({policy.max_loan_days} days)"
            )

        loan.due_at = due_at
        stamp_created_updated_by(loan, is_create=False)
        await db.flush()
        await db.refresh(loan)
        return loan

    async def remove(self, db: AsyncSession, loan_id: int) -> None:
        loan = await db.get(Loan, loan_id)
        if not loan:
            raise ValueError("Loan not found")

        if loan.returned_at is None:
            await self.execute(
                db,
                update(Book)
                .where(Book.id == loan.book_id)
                .values(copies_available=Book.copies_available + 1),
            )

        await db.delete(loan)
        await db.flush()


crud_loans = CRUDLoan()
