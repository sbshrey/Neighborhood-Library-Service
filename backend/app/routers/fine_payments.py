from datetime import datetime

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.fine_payments import crud_fine_payments
from ..db import get_db
from ..deps import require_roles
from ..schemas.fine_payments import FinePaymentLedgerOut
from ..utils.api_cache import api_cache, build_user_cache_key

router = APIRouter(prefix="/fine-payments", tags=["fine-payments"])


@router.get("", response_model=list[FinePaymentLedgerOut])
async def list_fine_payments(
    request: Request,
    q: str | None = Query(default=None, description="Search by loan, book, user, payment mode or reference"),
    payment_mode: list[str] = Query(default=[]),
    user_id: int | None = Query(default=None),
    loan_id: int | None = Query(default=None),
    collected_from: datetime | None = Query(default=None),
    collected_to: datetime | None = Query(default=None),
    sort_by: str = Query(default="collected_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("staff", "admin")),
):
    cache_key = build_user_cache_key(request, scope="fine_payments:list")
    cached = await api_cache.get_json(cache_key)
    if cached is not None:
        return cached

    rows = await crud_fine_payments.list_ledger(
        db,
        q=q,
        payment_mode=payment_mode,
        user_id=user_id,
        loan_id=loan_id,
        collected_from=collected_from,
        collected_to=collected_to,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )
    payload = [FinePaymentLedgerOut.model_validate(row).model_dump(mode="json") for row in rows]
    await api_cache.set_json(cache_key, payload)
    return payload
