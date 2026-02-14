from typing import Any

from .request_context import get_actor_user_id


def stamp_created_updated_by(obj: Any, *, is_create: bool) -> None:
    actor_user_id = get_actor_user_id()
    if actor_user_id is None:
        return
    if is_create and hasattr(obj, "created_by") and getattr(obj, "created_by", None) is None:
        setattr(obj, "created_by", actor_user_id)
    if hasattr(obj, "updated_by"):
        setattr(obj, "updated_by", actor_user_id)
