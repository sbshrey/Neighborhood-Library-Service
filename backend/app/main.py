from collections import defaultdict, deque
from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal
import json
import logging
from time import monotonic
from typing import Any
from urllib.parse import urlparse

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.inspection import inspect as sa_inspect
from starlette.concurrency import iterate_in_threadpool
from starlette.responses import JSONResponse

from .config import settings
from .db import Base, SessionLocal, engine
from .models import AuditLog, Book, LibraryPolicy, Loan, User
from .routers import audit as audit_router
from .routers import auth as auth_router
from .routers import books as books_router
from .routers import fine_payments as fine_payments_router
from .routers import imports as imports_router
from .routers import loans as loans_router
from .routers import policies as policies_router
from .routers import seed as seed_router
from .routers import users as users_router
from .utils.api_cache import api_cache
from .utils.request_context import (
    get_actor_role,
    get_actor_user_id,
    reset_actor_context,
    set_actor_context,
)
from .utils.security import decode_access_token


@asynccontextmanager
async def lifespan(_: FastAPI):
    if settings.auto_create_schema:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(title=settings.api_title, version=settings.api_version, lifespan=lifespan)
audit_logger = logging.getLogger("audit")
login_attempts: dict[str, deque[float]] = defaultdict(deque)


def _parse_cors(origins: str) -> list[str]:
    parsed = [origin.strip() for origin in origins.split(",") if origin.strip()]
    expanded = set(parsed)
    for origin in parsed:
        try:
            parsed_origin = urlparse(origin)
        except ValueError:
            continue
        if parsed_origin.scheme not in {"http", "https"}:
            continue
        if parsed_origin.hostname == "localhost":
            port = f":{parsed_origin.port}" if parsed_origin.port else ""
            expanded.add(f"{parsed_origin.scheme}://127.0.0.1{port}")
        elif parsed_origin.hostname == "127.0.0.1":
            port = f":{parsed_origin.port}" if parsed_origin.port else ""
            expanded.add(f"{parsed_origin.scheme}://localhost{port}")
    return sorted(expanded)


def _local_cors_regex(origins: str) -> str | None:
    parsed = [origin.strip() for origin in origins.split(",") if origin.strip()]
    for origin in parsed:
        try:
            parsed_origin = urlparse(origin)
        except ValueError:
            continue
        if parsed_origin.scheme not in {"http", "https"}:
            continue
        if parsed_origin.hostname in {"localhost", "127.0.0.1"}:
            return r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    return None


def _extract_actor_from_header(auth_header: str) -> tuple[int | None, str | None, str]:
    if not auth_header.startswith("Bearer "):
        return None, None, "-"
    try:
        payload = decode_access_token(auth_header.removeprefix("Bearer ").strip())
        user_id = payload.get("uid")
        role = payload.get("role")
        if isinstance(user_id, int) and isinstance(role, str):
            return user_id, role, str(user_id)
        return None, None, "invalid-token"
    except ValueError:
        return None, None, "invalid-token"


def _extract_entity_from_path(path: str) -> tuple[str | None, int | None]:
    segments = [segment for segment in path.strip("/").split("/") if segment]
    if not segments:
        return None, None
    entity = segments[0].lower()
    entity_id = int(segments[1]) if len(segments) > 1 and segments[1].isdigit() else None
    return entity, entity_id


async def _response_body_bytes(response: Any) -> bytes | None:
    body = getattr(response, "body", None)
    if body is not None:
        return bytes(body)
    body_iterator = getattr(response, "body_iterator", None)
    if body_iterator is None:
        return None
    chunks = [chunk async for chunk in body_iterator]
    content = b"".join(chunks)
    response.body_iterator = iterate_in_threadpool(iter([content]))
    return content


async def _extract_entity_id_from_response(response: Any) -> int | None:
    body = await _response_body_bytes(response)
    if body is None:
        return None
    try:
        payload = json.loads(body)
    except (TypeError, ValueError):
        return None
    if not isinstance(payload, dict):
        return None
    value = payload.get("id")
    return value if isinstance(value, int) else None


def _to_jsonable(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, dict):
        return {key: _to_jsonable(entry) for key, entry in value.items()}
    if isinstance(value, list):
        return [_to_jsonable(entry) for entry in value]
    return value


def _model_snapshot(instance: Any) -> dict[str, Any]:
    mapper = sa_inspect(instance.__class__)
    snapshot: dict[str, Any] = {}
    for column in mapper.columns:
        key = column.key
        # Avoid storing secrets in audit logs.
        if key in {"password_hash"}:
            continue
        snapshot[key] = _to_jsonable(getattr(instance, key))
    return snapshot


def _compute_change_diff(
    before_snapshot: dict[str, Any] | None, after_snapshot: dict[str, Any] | None
) -> dict[str, Any] | None:
    if before_snapshot is None and after_snapshot is None:
        return None
    if before_snapshot is None:
        return {"_created": {"from": None, "to": after_snapshot}}
    if after_snapshot is None:
        return {"_deleted": {"from": before_snapshot, "to": None}}

    changed: dict[str, Any] = {}
    keys = set(before_snapshot) | set(after_snapshot)
    for key in sorted(keys):
        before_value = before_snapshot.get(key)
        after_value = after_snapshot.get(key)
        if before_value != after_value:
            changed[key] = {"from": before_value, "to": after_value}
    return changed or None


async def _load_entity_snapshot(
    *,
    entity: str | None,
    entity_id: int | None,
    path: str,
) -> dict[str, Any] | None:
    if entity is None:
        return None
    async with SessionLocal() as session:
        target: Any | None = None
        if entity == "books" and entity_id is not None:
            target = await session.get(Book, entity_id)
        elif entity == "users" and entity_id is not None:
            target = await session.get(User, entity_id)
        elif entity == "loans" and entity_id is not None:
            target = await session.get(Loan, entity_id)
        elif entity == "settings" and path == "/settings/policy":
            target = await session.scalar(select(LibraryPolicy).limit(1))

        if target is None:
            return None
        return _model_snapshot(target)


async def _persist_audit_log(
    *,
    actor_user_id: int | None,
    actor_role: str | None,
    method: str,
    path: str,
    entity: str | None,
    entity_id: int | None,
    change_diff: dict[str, Any] | None,
    status_code: int,
    duration_ms: float,
) -> None:
    async with SessionLocal() as session:
        session.add(
            AuditLog(
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                method=method,
                path=path,
                entity=entity,
                entity_id=entity_id,
                change_diff=change_diff,
                status_code=status_code,
                duration_ms=duration_ms,
            )
        )
        await session.commit()


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors(settings.cors_origins),
    allow_origin_regex=_local_cors_regex(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def login_rate_limit(request: Request, call_next):
    if request.method == "POST" and request.url.path == "/auth/login":
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{request.url.path}"
        now = monotonic()
        window = settings.auth_login_rate_limit_window_seconds
        bucket = login_attempts[key]
        while bucket and now - bucket[0] > window:
            bucket.popleft()
        if len(bucket) >= settings.auth_login_rate_limit_per_window:
            return JSONResponse(
                {"detail": "Too many login attempts. Please retry later."},
                status_code=429,
            )
        bucket.append(now)
    return await call_next(request)


@app.middleware("http")
async def request_actor_context(request: Request, call_next):
    auth_header = request.headers.get("Authorization", "")
    user_id, role, _ = _extract_actor_from_header(auth_header)
    request.state.actor_user_id = user_id
    request.state.actor_role = role
    tokens = set_actor_context(user_id, role)
    try:
        return await call_next(request)
    finally:
        reset_actor_context(tokens)


@app.middleware("http")
async def audit_requests(request: Request, call_next):
    start = monotonic()
    auth_header = request.headers.get("Authorization", "")
    entity, entity_id = _extract_entity_from_path(request.url.path)
    before_snapshot: dict[str, Any] | None = None
    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        before_snapshot = await _load_entity_snapshot(
            entity=entity,
            entity_id=entity_id,
            path=request.url.path,
        )

    response = await call_next(request)
    if not settings.audit_log_enabled:
        return response

    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        state_actor_user_id = getattr(request.state, "actor_user_id", None)
        state_actor_role = getattr(request.state, "actor_role", None)
        actor_user_id = state_actor_user_id if state_actor_user_id is not None else get_actor_user_id()
        actor_role = state_actor_role if state_actor_role is not None else get_actor_role()
        if actor_user_id is None:
            header_actor_user_id, header_actor_role, _ = _extract_actor_from_header(auth_header)
            actor_user_id = header_actor_user_id
            actor_role = header_actor_role
        user_id_for_log = str(actor_user_id) if actor_user_id is not None else "-"
        after_snapshot: dict[str, Any] | None = None
        resolved_entity_id = entity_id
        if resolved_entity_id is None and request.method == "POST" and response.status_code < 400:
            resolved_entity_id = await _extract_entity_id_from_response(response)
        if request.method != "DELETE":
            after_snapshot = await _load_entity_snapshot(
                entity=entity,
                entity_id=resolved_entity_id,
                path=request.url.path,
            )
        change_diff = _compute_change_diff(before_snapshot, after_snapshot)
        duration_ms = (monotonic() - start) * 1000
        audit_logger.info(
            "method=%s path=%s status=%s user_id=%s role=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            user_id_for_log,
            actor_role or "-",
            duration_ms,
        )
        try:
            await _persist_audit_log(
                actor_user_id=actor_user_id,
                actor_role=actor_role,
                method=request.method,
                path=request.url.path,
                entity=entity,
                entity_id=resolved_entity_id,
                change_diff=change_diff,
                status_code=response.status_code,
                duration_ms=duration_ms,
            )
        except Exception:
            audit_logger.exception("Failed to persist audit log entry")
    return response


@app.middleware("http")
async def invalidate_api_cache_on_mutation(request: Request, call_next):
    response = await call_next(request)
    if request.method in {"POST", "PATCH", "PUT", "DELETE"} and response.status_code < 500:
        await api_cache.invalidate_all()
    return response


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(books_router.router)
app.include_router(users_router.router)
app.include_router(loans_router.router)
app.include_router(fine_payments_router.router)
app.include_router(seed_router.router)
app.include_router(auth_router.router)
app.include_router(imports_router.router)
app.include_router(policies_router.router)
app.include_router(audit_router.router)
