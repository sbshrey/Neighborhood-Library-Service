from contextvars import ContextVar, Token
from dataclasses import dataclass
from typing import Any


actor_user_id_ctx: ContextVar[int | None] = ContextVar("actor_user_id", default=None)
actor_role_ctx: ContextVar[str | None] = ContextVar("actor_role", default=None)
actor_user_ctx: ContextVar[Any | None] = ContextVar("actor_user", default=None)


@dataclass
class ContextTokens:
    user_id: Token
    role: Token
    user: Token


def set_actor_context(user_id: int | None, role: str | None) -> ContextTokens:
    return ContextTokens(
        user_id=actor_user_id_ctx.set(user_id),
        role=actor_role_ctx.set(role),
        user=actor_user_ctx.set(None),
    )


def reset_actor_context(tokens: ContextTokens) -> None:
    actor_user_id_ctx.reset(tokens.user_id)
    actor_role_ctx.reset(tokens.role)
    actor_user_ctx.reset(tokens.user)


def get_actor_user_id() -> int | None:
    return actor_user_id_ctx.get()


def get_actor_role() -> str | None:
    return actor_role_ctx.get()


def set_actor_user(user: Any) -> None:
    actor_user_ctx.set(user)


def get_actor_user() -> Any | None:
    return actor_user_ctx.get()
