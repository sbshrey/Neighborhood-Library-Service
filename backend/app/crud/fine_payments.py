from datetime import datetime, timezone

from sqlalchemy import String, asc, cast, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Book, FinePayment, Loan, User
from ..schemas.fine_payments import FinePaymentCreate, FineSummaryOut
from ..utils.audit_fields import stamp_created_updated_by
from .base import SQLQueryRunner


class CRUDFinePayments(SQLQueryRunner):
    @staticmethod
    def _estimated_fine(loan: Loan) -> float:
        due = loan.due_at
        if due.tzinfo is None:
            due = due.replace(tzinfo=timezone.utc)
        reference = loan.returned_at or datetime.now(timezone.utc)
        if reference.tzinfo is None:
            reference = reference.replace(tzinfo=timezone.utc)
        overdue_days = max(0, (reference.date() - due.date()).days)
        return round(overdue_days * settings.overdue_fine_per_day, 2)

    async def paid_amount(self, db: AsyncSession, loan_id: int) -> float:
        paid = await self.scalar(
            db,
            select(func.coalesce(func.sum(FinePayment.amount), 0)).where(FinePayment.loan_id == loan_id),
            default=0,
        )
        return round(float(paid or 0), 2)

    async def paid_amounts_by_loans(self, db: AsyncSession, loan_ids: list[int]) -> dict[int, float]:
        if not loan_ids:
            return {}
        rows = await self.rows_all(
            db,
            select(FinePayment.loan_id, func.coalesce(func.sum(FinePayment.amount), 0))
            .where(FinePayment.loan_id.in_(loan_ids))
            .group_by(FinePayment.loan_id),
        )
        return {int(loan_id): round(float(total or 0), 2) for loan_id, total in rows}

    async def summary_for_loan(self, db: AsyncSession, loan: Loan) -> FineSummaryOut:
        estimated = self._estimated_fine(loan)
        paid = await self.paid_amount(db, loan.id)
        due = round(max(estimated - paid, 0.0), 2)
        payment_count = await self.scalar(
            db,
            select(func.count(FinePayment.id)).where(FinePayment.loan_id == loan.id),
            default=0,
        )
        return FineSummaryOut(
            loan_id=loan.id,
            estimated_fine=estimated,
            fine_paid=paid,
            fine_due=due,
            payment_count=int(payment_count or 0),
            is_settled=estimated > 0 and due <= 0,
        )

    async def create_for_loan(
        self, db: AsyncSession, *, loan_id: int, payload: FinePaymentCreate
    ) -> FinePayment:
        loan = await db.get(Loan, loan_id)
        if not loan:
            raise ValueError("Loan not found")
        summary = await self.summary_for_loan(db, loan)
        if summary.fine_due <= 0:
            raise ValueError("No outstanding fine for this loan")
        if payload.amount > summary.fine_due:
            raise ValueError("Payment amount exceeds outstanding fine")

        payment = FinePayment(
            loan_id=loan.id,
            user_id=loan.user_id,
            amount=round(float(payload.amount), 2),
            payment_mode=payload.payment_mode,
            reference=payload.reference.strip() if payload.reference else None,
            notes=payload.notes.strip() if payload.notes else None,
        )
        stamp_created_updated_by(payment, is_create=True)
        db.add(payment)
        await db.flush()
        await db.refresh(payment)
        return payment

    async def list_for_loan(self, db: AsyncSession, *, loan_id: int) -> list[FinePayment]:
        return await self.scalars_all(
            db,
            select(FinePayment)
            .where(FinePayment.loan_id == loan_id)
            .order_by(FinePayment.collected_at.desc(), FinePayment.id.desc()),
        )

    async def list_ledger(
        self,
        db: AsyncSession,
        *,
        q: str | None = None,
        payment_mode: list[str] | None = None,
        user_id: int | None = None,
        loan_id: int | None = None,
        collected_from: datetime | None = None,
        collected_to: datetime | None = None,
        sort_by: str = "collected_at",
        sort_order: str = "desc",
        skip: int = 0,
        limit: int = 100,
    ) -> list[dict]:
        statement = (
            select(
                FinePayment.id,
                FinePayment.loan_id,
                FinePayment.user_id,
                FinePayment.amount,
                FinePayment.payment_mode,
                FinePayment.reference,
                FinePayment.notes,
                FinePayment.collected_at,
                FinePayment.created_at,
                Book.id.label("book_id"),
                Book.title.label("book_title"),
                Book.author.label("book_author"),
                Book.isbn.label("book_isbn"),
                User.name.label("user_name"),
                User.email.label("user_email"),
                User.phone.label("user_phone"),
            )
            .join(Loan, Loan.id == FinePayment.loan_id)
            .join(Book, Book.id == Loan.book_id)
            .join(User, User.id == FinePayment.user_id)
        )

        if q and q.strip():
            term = f"%{q.strip()}%"
            statement = statement.where(
                or_(
                    cast(FinePayment.id, String).ilike(term),
                    cast(FinePayment.loan_id, String).ilike(term),
                    cast(FinePayment.user_id, String).ilike(term),
                    cast(Book.id, String).ilike(term),
                    Book.title.ilike(term),
                    Book.author.ilike(term),
                    func.coalesce(Book.isbn, "").ilike(term),
                    User.name.ilike(term),
                    func.coalesce(User.email, "").ilike(term),
                    func.coalesce(User.phone, "").ilike(term),
                    FinePayment.payment_mode.ilike(term),
                    func.coalesce(FinePayment.reference, "").ilike(term),
                )
            )

        if payment_mode:
            normalized = [value.strip().lower() for value in payment_mode if value.strip()]
            if normalized:
                statement = statement.where(FinePayment.payment_mode.in_(normalized))

        if user_id is not None:
            statement = statement.where(FinePayment.user_id == user_id)
        if loan_id is not None:
            statement = statement.where(FinePayment.loan_id == loan_id)
        if collected_from is not None:
            statement = statement.where(FinePayment.collected_at >= collected_from)
        if collected_to is not None:
            statement = statement.where(FinePayment.collected_at <= collected_to)

        order_fields = {
            "collected_at": FinePayment.collected_at,
            "amount": FinePayment.amount,
            "loan_id": FinePayment.loan_id,
            "user_name": User.name,
            "book_title": Book.title,
            "payment_mode": FinePayment.payment_mode,
            "id": FinePayment.id,
        }
        order_column = order_fields.get(sort_by, FinePayment.collected_at)
        order_func = asc if sort_order.lower() == "asc" else desc
        statement = statement.order_by(order_func(order_column), desc(FinePayment.id))
        statement = statement.offset(skip).limit(limit)

        rows = await self.rows_all(db, statement)
        return [dict(row._mapping) for row in rows]


crud_fine_payments = CRUDFinePayments()
