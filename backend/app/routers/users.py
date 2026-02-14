from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.users import crud_users
from ..db import get_db
from ..deps import (
    get_current_user,
    require_admin_or_bootstrap_for_user_create,
    require_roles,
)
from ..models import User
from ..schemas.fine_payments import FinePaymentOut
from ..schemas.loans import BorrowedBookOut, UserLoanOut
from ..schemas.users import UserCreate, UserOut, UserUpdate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserOut])
async def list_users(
    q: str | None = Query(default=None, description="Search by name/email/phone"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    return await crud_users.list(db, q=q, skip=skip, limit=limit)


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.get("/me/loans", response_model=list[UserLoanOut])
async def list_my_loans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = await crud_users.list_loans_with_books(db, user_id=current_user.id)
    return [
        UserLoanOut(
            id=loan.id,
            book_id=loan.book_id,
            user_id=loan.user_id,
            borrowed_at=loan.borrowed_at,
            due_at=loan.due_at,
            returned_at=loan.returned_at,
            fine_paid=round(float(fine_paid or 0), 2),
            book_title=book.title,
            book_author=book.author,
            book_isbn=book.isbn,
        )
        for loan, book, fine_paid in rows
    ]


@router.get("/me/fine-payments", response_model=list[FinePaymentOut])
async def list_my_fine_payments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await crud_users.list_fine_payments(db, user_id=current_user.id)


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

    user = await crud_users.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")

    rows = await crud_users.list_active_borrowed_books(db, user_id=user_id)
    return [BorrowedBookOut(**row) for row in rows]


def _user_integrity_error_handler(exc: IntegrityError) -> tuple[int, str]:
    if "users_email_key" in str(exc.orig):
        return 409, "Email already exists."
    return 409, "User data conflicts with existing records."


async def _user_delete_precheck(user_id: int, db: AsyncSession) -> None:
    if await crud_users.active_loans(db, user_id) > 0:
        raise HTTPException(status_code=400, detail="User has active loans and cannot be deleted.")


@router.post("", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    _: User | None = Depends(require_admin_or_bootstrap_for_user_create),
):
    try:
        return await crud_users.create(db, obj_in=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        code, detail = _user_integrity_error_handler(exc)
        raise HTTPException(status_code=code, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while creating user.") from exc


@router.get("/{user_id}", response_model=UserOut)
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    user = await crud_users.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    return user


@router.patch("/{user_id}", response_model=UserOut)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_roles("staff", "admin")),
):
    user = await crud_users.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if current_user.role != "admin":
        if user.role == "admin":
            raise HTTPException(status_code=403, detail="Only admins can edit admin users.")
        if payload.role == "admin":
            raise HTTPException(status_code=403, detail="Only admins can assign admin role.")
    try:
        return await crud_users.update(db, db_obj=user, obj_in=payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except IntegrityError as exc:
        await db.rollback()
        code, detail = _user_integrity_error_handler(exc)
        raise HTTPException(status_code=code, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while updating user.") from exc


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    user = await crud_users.get(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    await _user_delete_precheck(user_id, db)
    try:
        await crud_users.remove(db, obj_id=user_id)
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while deleting user.") from exc
