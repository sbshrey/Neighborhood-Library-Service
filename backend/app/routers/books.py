from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.books import crud_books
from ..db import get_db
from ..deps import get_current_user, require_roles
from ..models import Book
from ..schemas.books import BookCreate, BookOut, BookUpdate
from .crud import register_crud_endpoints

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=list[BookOut])
async def list_books(
    q: str | None = Query(default=None, description="Search in title/author/isbn"),
    available_only: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_user),
):
    stmt = select(Book)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Book.title.ilike(like), Book.author.ilike(like), Book.isbn.ilike(like)))
    if available_only:
        stmt = stmt.where(Book.copies_available > 0)
    stmt = stmt.order_by(Book.title.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())

async def _book_delete_precheck(book_id: int, db: AsyncSession) -> None:
    if await crud_books.active_loans(db, book_id) > 0:
        raise HTTPException(status_code=400, detail="Book has active loans and cannot be deleted.")


register_crud_endpoints(
    router,
    crud=crud_books,
    create_schema=BookCreate,
    update_schema=BookUpdate,
    response_schema=BookOut,
    not_found_detail="Book not found.",
    create_dependencies=[Depends(require_roles("staff", "admin"))],
    get_dependencies=[Depends(get_current_user)],
    update_dependencies=[Depends(require_roles("staff", "admin"))],
    delete_dependencies=[Depends(require_roles("staff", "admin"))],
    delete_precheck=_book_delete_precheck,
    create_db_error_detail="Database error while creating book.",
    update_db_error_detail="Database error while updating book.",
)
