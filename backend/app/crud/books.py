from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import Book, Loan
from ..schemas.books import BookCreate, BookUpdate
from .base import CRUDBase


class CRUDBook(CRUDBase[Book, BookCreate, BookUpdate]):
    async def active_loans(self, db: AsyncSession, book_id: int) -> int:
        return await db.scalar(
            select(func.count(Loan.id)).where(Loan.book_id == book_id, Loan.returned_at.is_(None))
        )

    async def create(self, db: AsyncSession, *, obj_in: BookCreate) -> Book:
        book = Book(
            title=obj_in.title.strip(),
            author=obj_in.author.strip(),
            isbn=obj_in.isbn.strip() if obj_in.isbn else None,
            published_year=obj_in.published_year,
            copies_total=obj_in.copies_total,
            copies_available=obj_in.copies_total,
        )
        db.add(book)
        await db.flush()
        await db.refresh(book)
        return book

    async def update(self, db: AsyncSession, *, db_obj: Book, obj_in: BookUpdate) -> Book:
        updates = obj_in.model_dump(exclude_unset=True)
        if "copies_total" in updates:
            active_loans = await self.active_loans(db, db_obj.id)
            if updates["copies_total"] < active_loans:
                raise ValueError("copies_total cannot be less than active loans")
            delta = updates["copies_total"] - db_obj.copies_total
            db_obj.copies_available = max(db_obj.copies_available + delta, 0)

        for key, value in updates.items():
            setattr(db_obj, key, value)
        await db.flush()
        await db.refresh(db_obj)
        return db_obj


crud_books = CRUDBook(Book)
