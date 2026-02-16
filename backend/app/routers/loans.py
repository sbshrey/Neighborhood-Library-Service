from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.fine_payments import crud_fine_payments
from ..crud.loans import crud_loans
from ..db import get_db
from ..deps import require_roles
from ..schemas.fine_payments import FinePaymentCreate, FinePaymentOut, FineSummaryOut
from ..schemas.loans import LoanCreate, LoanOut, LoanUpdate
from ..utils.api_cache import api_cache, build_user_cache_key

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
    request: Request,
    q: str | None = Query(default=None),
    active: bool | None = Query(default=None),
    overdue_only: bool = Query(default=False),
    user_id: int | None = Query(default=None),
    book_id: int | None = Query(default=None),
    sort_by: str = Query(default="borrowed_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    cache_key = build_user_cache_key(request, scope="loans:list")
    cached = await api_cache.get_json(cache_key)
    if cached is not None:
        return cached

    rows = await crud_loans.list(
        db,
        q=q,
        active=active,
        user_id=user_id,
        book_id=book_id,
        overdue_only=overdue_only,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )
    payload = [LoanOut.model_validate(row).model_dump(mode="json") for row in rows]
    await api_cache.set_json(cache_key, payload)
    return payload


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
