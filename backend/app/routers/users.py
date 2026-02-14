from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.users import crud_users
from ..db import get_db
from ..deps import (
    get_current_user,
    require_admin_or_bootstrap_for_user_create,
    require_roles,
)
from ..models import Loan, User
from ..schemas.loans import BorrowedBookOut
from ..schemas.users import UserCreate, UserOut, UserUpdate
from .crud import register_crud_endpoints

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    q: str | None = Query(default=None, description="Search by name/email/phone"),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    stmt = select(User)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(
            or_(User.name.ilike(like), User.email.ilike(like), User.phone.ilike(like))
        )
    stmt = stmt.order_by(User.name.asc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/{user_id}/borrowed", response_model=list[BorrowedBookOut])
async def list_borrowed_books(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "member" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    if current_user.role not in {"member", "staff", "admin"}:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    stmt = (
        select(Loan.id, Loan.book_id, Loan.borrowed_at, Loan.due_at, Loan.returned_at)
        .where(Loan.user_id == user_id, Loan.returned_at.is_(None))
        .subquery()
    )
    # Join with books for title/author
    from ..models import Book

    joined = (
        select(
            stmt.c.id.label("loan_id"),
            Book.id.label("book_id"),
            Book.title.label("title"),
            Book.author.label("author"),
            stmt.c.borrowed_at,
            stmt.c.due_at,
        )
        .join(Book, Book.id == stmt.c.book_id)
        .order_by(stmt.c.due_at.asc())
    )
    rows = (await db.execute(joined)).all()
    return [
        BorrowedBookOut(
            loan_id=row.loan_id,
            book_id=row.book_id,
            title=row.title,
            author=row.author,
            borrowed_at=row.borrowed_at,
            due_at=row.due_at,
        )
        for row in rows
    ]


def _user_integrity_error_handler(exc: IntegrityError) -> tuple[int, str]:
    if "users_email_key" in str(exc.orig):
        return 409, "Email already exists."
    return 409, "User data conflicts with existing records."


async def _user_delete_precheck(user_id: int, db: AsyncSession) -> None:
    if await crud_users.active_loans(db, user_id) > 0:
        raise HTTPException(status_code=400, detail="User has active loans and cannot be deleted.")


register_crud_endpoints(
    router,
    crud=crud_users,
    create_schema=UserCreate,
    update_schema=UserUpdate,
    response_schema=UserOut,
    not_found_detail="User not found.",
    create_dependencies=[Depends(require_admin_or_bootstrap_for_user_create)],
    get_dependencies=[Depends(require_roles("staff", "admin"))],
    update_dependencies=[Depends(require_roles("admin"))],
    delete_dependencies=[Depends(require_roles("admin"))],
    delete_precheck=_user_delete_precheck,
    integrity_error_handler=_user_integrity_error_handler,
    create_db_error_detail="Database error while creating user.",
    update_db_error_detail="Database error while updating user.",
)
