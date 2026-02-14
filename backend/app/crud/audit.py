from sqlalchemy import String, cast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import AuditLog
from .base import SQLQueryRunner


class CRUDAudit(SQLQueryRunner):
    async def list_logs(
        self,
        db: AsyncSession,
        *,
        q: str | None,
        method: str | None,
        entity: str | None,
        status_code: int | None,
        limit: int,
    ) -> list[AuditLog]:
        stmt = select(AuditLog)
        if q:
            like = f"%{q}%"
            stmt = stmt.where(
                or_(
                    AuditLog.path.ilike(like),
                    AuditLog.method.ilike(like),
                    AuditLog.actor_role.ilike(like),
                    AuditLog.entity.ilike(like),
                    cast(AuditLog.entity_id, String).ilike(like),
                    cast(AuditLog.actor_user_id, String).ilike(like),
                    cast(AuditLog.status_code, String).ilike(like),
                )
            )
        if method:
            stmt = stmt.where(AuditLog.method == method.upper())
        if entity:
            stmt = stmt.where(AuditLog.entity == entity.lower())
        if status_code is not None:
            stmt = stmt.where(AuditLog.status_code == status_code)
        stmt = stmt.order_by(AuditLog.created_at.desc()).limit(limit)
        return await self.scalars_all(db, stmt)


crud_audit = CRUDAudit()
