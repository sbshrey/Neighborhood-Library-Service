from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditLogOut(BaseModel):
    id: int
    actor_user_id: int | None
    actor_role: str | None
    method: str
    path: str
    entity: str | None
    entity_id: int | None
    change_diff: dict | None = None
    status_code: int
    duration_ms: float
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)
