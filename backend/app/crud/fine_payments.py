from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import FinePayment, Loan
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


crud_fine_payments = CRUDFinePayments()
