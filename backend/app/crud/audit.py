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
        method: list[str] | None,
        entity: list[str] | None,
        status_code: int | None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        skip: int,
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
        normalized_methods = [value.strip().upper() for value in (method or []) if value.strip()]
        if normalized_methods:
            stmt = stmt.where(AuditLog.method.in_(normalized_methods))
        normalized_entities = [value.strip().lower() for value in (entity or []) if value.strip()]
        if normalized_entities:
            stmt = stmt.where(AuditLog.entity.in_(normalized_entities))
        if status_code is not None:
            stmt = stmt.where(AuditLog.status_code == status_code)
        sort_columns = {
            "created_at": AuditLog.created_at,
            "status_code": AuditLog.status_code,
            "duration_ms": AuditLog.duration_ms,
            "id": AuditLog.id,
        }
        sort_column = sort_columns.get(sort_by, AuditLog.created_at)
        order = sort_column.desc() if sort_order.lower() == "desc" else sort_column.asc()
        stmt = stmt.order_by(order, AuditLog.id.desc()).offset(skip).limit(limit)
        return await self.scalars_all(db, stmt)


crud_audit = CRUDAudit()
