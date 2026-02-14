from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .db import Base, engine
from .routers import auth as auth_router
from .routers import books as books_router
from .routers import loans as loans_router
from .routers import seed as seed_router
from .routers import users as users_router

app = FastAPI(title=settings.api_title, version=settings.api_version)


def _parse_cors(origins: str) -> list[str]:
    return [origin.strip() for origin in origins.split(",") if origin.strip()]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_parse_cors(settings.cors_origins),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
