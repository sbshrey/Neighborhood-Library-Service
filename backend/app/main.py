from collections import defaultdict, deque
from time import monotonic
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from starlette.responses import JSONResponse

from .config import settings
from .db import Base, engine
from .routers import auth as auth_router
from .routers import books as books_router
from .routers import loans as loans_router
from .routers import seed as seed_router
from .routers import users as users_router
from .utils.security import decode_access_token

app = FastAPI(title=settings.api_title, version=settings.api_version)
audit_logger = logging.getLogger("audit")
login_attempts: dict[str, deque[float]] = defaultdict(deque)


def _parse_cors(origins: str) -> list[str]:
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors(settings.cors_origins),
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
async def audit_requests(request: Request, call_next):
    start = monotonic()
    response = await call_next(request)
    if not settings.audit_log_enabled:
        return response

    if request.method in {"POST", "PATCH", "PUT", "DELETE"}:
        auth_header = request.headers.get("Authorization", "")
        user_id = "-"
        role = "-"
        if auth_header.startswith("Bearer "):
            try:
                payload = decode_access_token(auth_header.removeprefix("Bearer ").strip())
                user_id = str(payload.get("uid", "-"))
                role = str(payload.get("role", "-"))
            except ValueError:
                user_id = "invalid-token"
        audit_logger.info(
            "method=%s path=%s status=%s user_id=%s role=%s duration_ms=%.2f",
            request.method,
            request.url.path,
            response.status_code,
            user_id,
            role,
            (monotonic() - start) * 1000,
        )
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
