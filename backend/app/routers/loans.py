from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.fine_payments import crud_fine_payments
from ..crud.loans import crud_loans
from ..db import get_db
from ..deps import require_roles
from ..schemas.fine_payments import FinePaymentCreate, FinePaymentOut, FineSummaryOut
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
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    return await crud_loans.list(
        db,
        active=active,
        user_id=user_id,
        book_id=book_id,
        overdue_only=overdue_only,
        skip=skip,
        limit=limit,
    )


@router.get("/{loan_id}/fine-summary", response_model=FineSummaryOut)
async def get_loan_fine_summary(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    loan = await crud_loans.get(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return await crud_fine_payments.summary_for_loan(db, loan)


@router.get("/{loan_id}/fine-payments", response_model=list[FinePaymentOut])
async def list_loan_fine_payments(
    loan_id: int,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    loan = await crud_loans.get(db, loan_id)
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")
    return await crud_fine_payments.list_for_loan(db, loan_id=loan_id)


@router.post("/{loan_id}/fine-payments", response_model=FinePaymentOut, status_code=status.HTTP_201_CREATED)
async def collect_fine_payment(
    loan_id: int,
    payload: FinePaymentCreate,
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    try:
        return await crud_fine_payments.create_for_loan(db, loan_id=loan_id, payload=payload)
    except ValueError as exc:
        detail = str(exc)
        if detail == "Loan not found":
            raise HTTPException(status_code=404, detail=detail) from exc
        raise HTTPException(status_code=400, detail=detail) from exc
    except SQLAlchemyError as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail="Database error while recording fine payment.") from exc


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
