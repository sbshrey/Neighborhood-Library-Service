from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.books import crud_books
from ..db import get_db
from ..deps import get_current_user, require_roles
from ..schemas.books import BookCreate, BookOut, BookUpdate
from .crud import register_crud_endpoints

router = APIRouter(prefix="/books", tags=["books"])


@router.get("", response_model=list[BookOut])
async def list_books(
    q: str | None = Query(default=None, description="Search in title/author/isbn"),
    subject: str | None = Query(default=None, description="Filter by subject"),
    published_year: int | None = Query(default=None, ge=0, le=2100),
    available_only: bool = Query(default=False),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(get_current_user),
):
    return await crud_books.list(
        db,
        q=q,
        subject=subject,
        published_year=published_year,
        available_only=available_only,
        skip=skip,
        limit=limit,
    )

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
    create_dependencies=[Depends(require_roles("admin"))],
    get_dependencies=[Depends(require_roles("staff", "admin"))],
    update_dependencies=[Depends(require_roles("admin"))],
    delete_dependencies=[Depends(require_roles("admin"))],
    delete_precheck=_book_delete_precheck,
    create_db_error_detail="Database error while creating book.",
    update_db_error_detail="Database error while updating book.",
)
