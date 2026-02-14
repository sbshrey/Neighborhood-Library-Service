from collections import defaultdict, deque
from time import monotonic
import logging
from urllib.parse import urlparse

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from starlette.responses import JSONResponse

from .config import settings
from .db import Base, SessionLocal, engine
from .models import AuditLog
from .routers import audit as audit_router
from .routers import auth as auth_router
from .routers import books as books_router
from .routers import imports as imports_router
from .routers import loans as loans_router
from .routers import policies as policies_router
from .routers import seed as seed_router
from .routers import users as users_router
from .utils.request_context import (
    get_actor_role,
    get_actor_user_id,
    reset_actor_context,
    set_actor_context,
)
from .utils.api_cache import api_cache
from .utils.security import decode_access_token

app = FastAPI(title=settings.api_title, version=settings.api_version)
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


async def _persist_audit_log(
    *,
    actor_user_id: int | None,
    actor_role: str | None,
    method: str,
    path: str,
    entity: str | None,
    entity_id: int | None,
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
    tokens = set_actor_context(user_id, role)
    try:
        return await call_next(request)
    finally:
        reset_actor_context(tokens)


@app.middleware("http")
async def audit_requests(request: Request, call_next):
    start = monotonic()
    response = await call_next(request)
    if not settings.audit_log_enabled:
        return response

    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        actor_user_id = get_actor_user_id()
        actor_role = get_actor_role()
        user_id_for_log = str(actor_user_id) if actor_user_id is not None else "-"
        entity, entity_id = _extract_entity_from_path(request.url.path)
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
                entity_id=entity_id,
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


@app.on_event("startup")
async def startup() -> None:
    if settings.auto_create_schema:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(books_router.router)
app.include_router(users_router.router)
app.include_router(loans_router.router)
app.include_router(seed_router.router)
app.include_router(auth_router.router)
app.include_router(imports_router.router)
app.include_router(policies_router.router)
app.include_router(audit_router.router)
