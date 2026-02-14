from __future__ import annotations

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Book, Loan
from ..schemas.books import BookCreate, BookUpdate
from ..utils.audit_fields import stamp_created_updated_by
from .base import CRUDBase


class CRUDBook(CRUDBase[Book, BookCreate, BookUpdate]):
    @staticmethod
    def _normalize_optional(value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    async def active_loans(self, db: AsyncSession, book_id: int) -> int:
        return int(
            await self.scalar(
                db,
                select(func.count(Loan.id)).where(Loan.book_id == book_id, Loan.returned_at.is_(None)),
                default=0,
            )
        )

    async def count_all(self, db: AsyncSession) -> int:
        return int(await self.scalar(db, select(func.count(Book.id)), default=0))

    async def get_by_isbn(self, db: AsyncSession, isbn: str) -> Book | None:
        return await self.scalar_one_or_none(db, select(Book).where(Book.isbn == isbn.strip()))

    async def find_natural_key(
        self,
        db: AsyncSession,
        *,
        title: str,
        author: str,
        published_year: int | None,
    ) -> Book | None:
        stmt = select(Book).where(
            func.lower(Book.title) == title.lower(),
            func.lower(Book.author) == author.lower(),
            Book.published_year.is_(published_year)
            if published_year is None
            else Book.published_year == published_year,
        )
        return await self.scalar_one_or_none(db, stmt)

    async def list(
        self,
        db: AsyncSession,
        *,
        q: str | None,
        subject: str | None,
        published_year: int | None,
        available_only: bool,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Book]:
        stmt = select(Book)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    Book.title.ilike(like),
                    Book.author.ilike(like),
                    Book.isbn.ilike(like),
                    Book.subject.ilike(like),
                    Book.rack_number.ilike(like),
                )
            )
        if subject:
            stmt = stmt.where(Book.subject.ilike(f"%{subject}%"))
        if published_year is not None:
            stmt = stmt.where(Book.published_year == published_year)
        if available_only:
            stmt = stmt.where(Book.copies_available > 0)
        stmt = stmt.order_by(Book.title.asc()).offset(skip).limit(limit)
        return await self.scalars_all(db, stmt)

    async def create(self, db: AsyncSession, *, obj_in: BookCreate) -> Book:
        book = Book(
            title=obj_in.title.strip(),
            author=obj_in.author.strip(),
            subject=self._normalize_optional(obj_in.subject),
            rack_number=self._normalize_optional(obj_in.rack_number),
            isbn=self._normalize_optional(obj_in.isbn),
            published_year=obj_in.published_year,
            copies_total=obj_in.copies_total,
            copies_available=obj_in.copies_total,
        )
        stamp_created_updated_by(book, is_create=True)
        db.add(book)
        await db.flush()
        await db.refresh(book)
        return book

    async def update(self, db: AsyncSession, *, db_obj: Book, obj_in: BookUpdate) -> Book:
        updates = obj_in.model_dump(exclude_unset=True)
        for key in ("title", "author", "subject", "rack_number", "isbn"):
            if key not in updates:
                continue
            value = updates[key]
            if value is None:
                continue
            if key in {"subject", "rack_number", "isbn"}:
                updates[key] = self._normalize_optional(value)
            else:
                updates[key] = value.strip()
        if "copies_total" in updates:
            active_loans = await self.active_loans(db, db_obj.id)
            if updates["copies_total"] < active_loans:
                raise ValueError("copies_total cannot be less than active loans")
            delta = updates["copies_total"] - db_obj.copies_total
            db_obj.copies_available = max(db_obj.copies_available + delta, 0)

        for key, value in updates.items():
            setattr(db_obj, key, value)
        stamp_created_updated_by(db_obj, is_create=False)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


crud_books = CRUDBook(Book)
