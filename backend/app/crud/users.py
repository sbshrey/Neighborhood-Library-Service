from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..config import settings
from ..models import Book, FinePayment, Loan, User
from ..schemas.users import UserCreate, UserUpdate
from ..utils.audit_fields import stamp_created_updated_by
from ..utils.security import hash_password
from .base import CRUDBase


class CRUDUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def count_all(self, db: AsyncSession) -> int:
        return int(await self.scalar(db, select(func.count(User.id)), default=0))

    async def get_by_email(self, db: AsyncSession, email: str) -> User | None:
        return await self.scalar_one_or_none(
            db,
            select(User).where(func.lower(User.email) == email.strip().lower()),
        )

    async def get_by_email_exact(self, db: AsyncSession, email: str) -> User | None:
        return await self.scalar_one_or_none(db, select(User).where(User.email == email.strip()))

    async def get_by_phone(self, db: AsyncSession, phone: str) -> User | None:
        return await self.scalar_one_or_none(db, select(User).where(User.phone == phone.strip()))

    async def find_import_duplicate(
        self,
        db: AsyncSession,
        *,
        name: str,
        role: str,
        email: str | None,
        phone: str | None,
    ) -> User | None:
        if email:
            return await self.get_by_email(db, email)
        if phone:
            return await self.get_by_phone(db, phone)
        return await self.scalar_one_or_none(
            db,
            select(User).where(
                func.lower(User.name) == name.lower(),
                User.role == role,
            ),
        )

    async def list(self, db: AsyncSession, *, q: str | None = None) -> list[User]:
        stmt = select(User)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(or_(User.name.ilike(like), User.email.ilike(like), User.phone.ilike(like)))
        stmt = stmt.order_by(User.name.asc())
        return await self.scalars_all(db, stmt)

    async def list_loans_with_books(self, db: AsyncSession, *, user_id: int) -> list[tuple[Loan, Book, float]]:
        fine_paid_subquery = (
            select(
                FinePayment.loan_id.label("loan_id"),
                func.coalesce(func.sum(FinePayment.amount), 0).label("fine_paid"),
            )
            .group_by(FinePayment.loan_id)
            .subquery()
        )
        stmt = (
            select(
                Loan,
                Book,
                func.coalesce(fine_paid_subquery.c.fine_paid, 0).label("fine_paid"),
            )
            .join(Book, Book.id == Loan.book_id)
            .outerjoin(fine_paid_subquery, fine_paid_subquery.c.loan_id == Loan.id)
            .where(Loan.user_id == user_id)
            .order_by(Loan.borrowed_at.desc())
        )
        return await self.rows_all(db, stmt)

    async def list_fine_payments(self, db: AsyncSession, *, user_id: int) -> list[FinePayment]:
        return await self.scalars_all(
            db,
            select(FinePayment)
            .where(FinePayment.user_id == user_id)
            .order_by(FinePayment.collected_at.desc(), FinePayment.id.desc()),
        )

    async def list_active_borrowed_books(self, db: AsyncSession, *, user_id: int) -> list[dict[str, object]]:
        active_loans = (
            select(Loan.id, Loan.book_id, Loan.borrowed_at, Loan.due_at, Loan.returned_at)
            .where(Loan.user_id == user_id, Loan.returned_at.is_(None))
            .subquery()
        )
        joined = (
            select(
                active_loans.c.id.label("loan_id"),
                Book.id.label("book_id"),
                Book.title.label("title"),
                Book.author.label("author"),
                active_loans.c.borrowed_at,
                active_loans.c.due_at,
            )
            .join(Book, Book.id == active_loans.c.book_id)
            .order_by(active_loans.c.due_at.asc())
        )
        rows = await self.rows_all(db, joined)
        return [
            {
                "loan_id": row.loan_id,
                "book_id": row.book_id,
                "title": row.title,
                "author": row.author,
                "borrowed_at": row.borrowed_at,
                "due_at": row.due_at,
            }
            for row in rows
        ]

    async def active_loans(self, db: AsyncSession, user_id: int) -> int:
        return int(
            await self.scalar(
                db,
                select(func.count(Loan.id)).where(Loan.user_id == user_id, Loan.returned_at.is_(None)),
                default=0,
            )
        )

    async def create(self, db: AsyncSession, *, obj_in: UserCreate) -> User:
        raw_password = obj_in.password or settings.default_user_password
        user = User(
            name=obj_in.name.strip(),
            email=obj_in.email.strip() if obj_in.email else None,
            phone=obj_in.phone.strip() if obj_in.phone else None,
            password_hash=hash_password(raw_password),
            role=obj_in.role,
        )
        stamp_created_updated_by(user, is_create=True)
        db.add(user)
        await db.flush()
        await db.refresh(user)
        return user

    async def update(self, db: AsyncSession, *, db_obj: User, obj_in: UserUpdate) -> User:
        updates = obj_in.model_dump(exclude_unset=True)
        if "password" in updates:
            password = updates.pop("password")
            if password:
                db_obj.password_hash = hash_password(password)
        for key, value in updates.items():
            setattr(db_obj, key, value)
        stamp_created_updated_by(db_obj, is_create=False)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


crud_users = CRUDUser(User)
