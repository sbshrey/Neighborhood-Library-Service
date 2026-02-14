from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.loans import crud_loans
from ..db import get_db
from ..deps import require_roles
from ..schemas.loans import LoanCreate, LoanOut, LoanUpdate

router = APIRouter(prefix="/loans", tags=["loans"])


@router.post("/borrow", response_model=LoanOut, status_code=status.HTTP_201_CREATED)
async def borrow_book(
    payload: LoanCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    try:
        loan = await crud_loans.borrow(db, payload)
        return loan
    except ValueError as exc:
        detail = str(exc)
        if detail == "User not found":
            raise HTTPException(status_code=404, detail=detail) from exc
        if detail == "Book not found":
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while borrowing book.") from exc


@router.post("/{loan_id}/return", response_model=LoanOut)
async def return_book(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    try:
        return await crud_loans.return_loan(db, loan_id)
    except ValueError as exc:
        detail = str(exc)
        if detail == "Loan not found":
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while returning book.") from exc


@router.get("", response_model=list[LoanOut])
async def list_loans(
    active: bool | None = Query(default=None),
    overdue_only: bool = Query(default=False),
    user_id: int | None = Query(default=None),
    book_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    return await crud_loans.list(
        db,
        active=active,
        user_id=user_id,
        book_id=book_id,
        overdue_only=overdue_only,
    )


@router.patch("/{loan_id}", response_model=LoanOut)
async def update_loan(
    loan_id: int,
    payload: LoanUpdate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    try:
        return await crud_loans.update(db, loan_id, payload)
    except ValueError as exc:
        detail = str(exc)
        if detail == "Loan not found":
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while updating loan.") from exc


@router.delete("/{loan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_loan(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    try:
        await crud_loans.remove(db, loan_id)
    except ValueError as exc:
        detail = str(exc)
        if detail == "Loan not found":
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while deleting loan.") from exc
