from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.audit import crud_audit
from ..db import get_db
from ..deps import require_roles
from ..schemas.audit import AuditLogOut
from ..utils.api_cache import api_cache, build_user_cache_key

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    request: Request,
    q: str | None = Query(default=None, description="Search in path/entity/method/role/id"),
    method: list[str] = Query(default=[]),
    entity: list[str] = Query(default=[]),
    status_code: int | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    cache_key = build_user_cache_key(request, scope="audit:list")
    cached = await api_cache.get_json(cache_key)
    if cached is not None:
        return cached

    rows = await crud_audit.list_logs(
        db,
        q=q,
        method=method,
        entity=entity,
        status_code=status_code,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )
    payload = [AuditLogOut.model_validate(row).model_dump(mode="json") for row in rows]
    await api_cache.set_json(cache_key, payload)
    return payload
