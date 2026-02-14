from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ..crud.audit import crud_audit
from ..db import get_db
from ..deps import require_roles
from ..schemas.audit import AuditLogOut

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("/logs", response_model=list[AuditLogOut])
async def list_audit_logs(
    q: str | None = Query(default=None, description="Search in path/entity/method/role/id"),
    method: str | None = Query(default=None),
    entity: str | None = Query(default=None),
    status_code: int | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    _: object = Depends(require_roles("admin")),
):
    return await crud_audit.list_logs(
        db,
        q=q,
        method=method,
        entity=entity,
        status_code=status_code,
        skip=skip,
        limit=limit,
    )
