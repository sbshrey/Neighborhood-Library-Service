import asyncio
from pathlib import Path
import tempfile

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db import Base, get_db
import app.main as app_main
from app.main import app, login_attempts

from tests.constants import TEST_AUTH_VALUE


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def test_engine():
    db_file = Path(tempfile.gettempdir()) / "nls_test.db"
    url = f"sqlite+aiosqlite:///{db_file}"
    engine = create_async_engine(url, future=True)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    await engine.dispose()


@pytest.fixture(scope="function")
async def db_session(test_engine):
    async_session = async_sessionmaker(
        bind=test_engine, class_=AsyncSession, autoflush=False, expire_on_commit=False
    )
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    async with async_session() as session:
        yield session


@pytest.fixture(scope="function")
async def client(db_session):
    audit_session_local = async_sessionmaker(
        bind=db_session.bind, class_=AsyncSession, autoflush=False, expire_on_commit=False
    )
    original_audit_session_local = app_main.SessionLocal
    app_main.SessionLocal = audit_session_local

    async def _override_get_db():
        try:
            yield db_session
            if db_session.in_transaction():
                await db_session.commit()
        except Exception:
            if db_session.in_transaction():
                await db_session.rollback()
            raise

    app.dependency_overrides[get_db] = _override_get_db
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    app_main.SessionLocal = original_audit_session_local


@pytest.fixture(autouse=True)
def clear_login_rate_limiter_state():
    login_attempts.clear()
    yield
    login_attempts.clear()


@pytest.fixture(scope="function")
async def auth_headers(client):
    bootstrap = await client.post(
        "/users",
        json={
            "name": "Test Admin",
            "email": "admin@test.dev",
            "role": "admin",
            "password": TEST_AUTH_VALUE,
        },
    )
    assert bootstrap.status_code == 201

    login = await client.post(
        "/auth/login",
        json={"email": "admin@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
