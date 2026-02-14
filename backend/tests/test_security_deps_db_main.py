import pytest
from fastapi import HTTPException
from jose import jwt

from app import db as db_module
from app import main as main_module
from app.config import settings
from app.crud.users import crud_users
from app.deps import (
    require_admin_or_bootstrap,
    require_admin_or_bootstrap_for_user_create,
    require_roles,
)
from app.schemas.users import UserCreate
from app.utils.security import create_access_token, decode_access_token
from tests.constants import TEST_AUTH_VALUE


@pytest.mark.asyncio
async def test_decode_access_token_rejects_invalid_and_missing_claims():
    with pytest.raises(ValueError):
        decode_access_token("not-a-jwt")

    token_missing_claims = jwt.encode(
        {"sub": "x", "exp": 4102444800},
        settings.jwt_secret_key,
        algorithm=settings.jwt_algorithm,
    )
    with pytest.raises(ValueError):
        decode_access_token(token_missing_claims)


@pytest.mark.asyncio
async def test_require_roles_checks_permissions():
    dep = require_roles("admin")
    admin = await dep(
        current_user=type("U", (), {"role": "admin"})()
    )
    assert admin.role == "admin"

    with pytest.raises(HTTPException) as exc:
        await dep(current_user=type("U", (), {"role": "member"})())
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_or_bootstrap_paths(db_session):
    assert await require_admin_or_bootstrap(db=db_session, token=None) is None

    member = await crud_users.create(
        db_session,
        obj_in=UserCreate(
            name="Member",
            email="member@test.dev",
            role="member",
            password=TEST_AUTH_VALUE,
        ),
    )
    await db_session.commit()

    with pytest.raises(HTTPException) as no_token:
        await require_admin_or_bootstrap(db=db_session, token=None)
    assert no_token.value.status_code == 401

    member_token = create_access_token(
        user_id=member.id, role=member.role, subject=member.email or str(member.id)
    )
    with pytest.raises(HTTPException) as non_admin:
        await require_admin_or_bootstrap(db=db_session, token=member_token)
    assert non_admin.value.status_code == 403

    admin = await crud_users.create(
        db_session,
        obj_in=UserCreate(
            name="Admin",
            email="admin@test.dev",
            role="admin",
            password=TEST_AUTH_VALUE,
        ),
    )
    await db_session.commit()
    admin_token = create_access_token(
        user_id=admin.id, role=admin.role, subject=admin.email or str(admin.id)
    )
    result = await require_admin_or_bootstrap(db=db_session, token=admin_token)
    assert result.id == admin.id


@pytest.mark.asyncio
async def test_require_admin_or_bootstrap_for_user_create_paths(db_session):
    with pytest.raises(HTTPException) as first_user_non_admin:
        await require_admin_or_bootstrap_for_user_create(
            payload=UserCreate(
                name="First",
                email="first@test.dev",
                role="member",
                password=TEST_AUTH_VALUE,
            ),
            db=db_session,
            token=None,
        )
    assert first_user_non_admin.value.status_code == 400

    allowed = await require_admin_or_bootstrap_for_user_create(
        payload=UserCreate(
            name="First Admin",
            email="first-admin@test.dev",
            role="admin",
            password=TEST_AUTH_VALUE,
        ),
        db=db_session,
        token=None,
    )
    assert allowed is None

    admin = await crud_users.create(
        db_session,
        obj_in=UserCreate(
            name="Admin",
            email="admin2@test.dev",
            role="admin",
            password=TEST_AUTH_VALUE,
        ),
    )
    member = await crud_users.create(
        db_session,
        obj_in=UserCreate(
            name="Member",
            email="member2@test.dev",
            role="member",
            password=TEST_AUTH_VALUE,
        ),
    )
    await db_session.commit()

    with pytest.raises(HTTPException) as no_token:
        await require_admin_or_bootstrap_for_user_create(
            payload=UserCreate(name="X", email="x@test.dev", role="member", password=TEST_AUTH_VALUE),
            db=db_session,
            token=None,
        )
    assert no_token.value.status_code == 401

    with pytest.raises(HTTPException) as bootstrap_done:
        await require_admin_or_bootstrap_for_user_create(
            payload=UserCreate(
                name="Admin Bootstrap Attempt",
                email="bootstrap-attempt@test.dev",
                role="admin",
                password=TEST_AUTH_VALUE,
            ),
            db=db_session,
            token=None,
        )
    assert bootstrap_done.value.status_code == 409

    member_token = create_access_token(
        user_id=member.id, role=member.role, subject=member.email or str(member.id)
    )
    with pytest.raises(HTTPException) as non_admin:
        await require_admin_or_bootstrap_for_user_create(
            payload=UserCreate(name="Y", email="y@test.dev", role="member", password=TEST_AUTH_VALUE),
            db=db_session,
            token=member_token,
        )
    assert non_admin.value.status_code == 403

    admin_token = create_access_token(
        user_id=admin.id, role=admin.role, subject=admin.email or str(admin.id)
    )
    result = await require_admin_or_bootstrap_for_user_create(
        payload=UserCreate(name="Z", email="z@test.dev", role="member", password=TEST_AUTH_VALUE),
        db=db_session,
        token=admin_token,
    )
    assert result.id == admin.id


class _FakeSession:
    def __init__(self):
        self._in_transaction = True
        self.committed = False
        self.rolled_back = False

    def in_transaction(self):
        return self._in_transaction

    async def commit(self):
        self.committed = True
        self._in_transaction = False

    async def rollback(self):
        self.rolled_back = True
        self._in_transaction = False


class _FakeSessionContext:
    def __init__(self, db):
        self.db = db

    async def __aenter__(self):
        return self.db

    async def __aexit__(self, exc_type, exc, tb):
        return False


@pytest.mark.asyncio
async def test_get_db_commits_and_rolls_back(monkeypatch):
    db_commit = _FakeSession()
    monkeypatch.setattr(db_module, "SessionLocal", lambda: _FakeSessionContext(db_commit))
    gen = db_module.get_db()
    _ = await gen.__anext__()
    with pytest.raises(StopAsyncIteration):
        await gen.__anext__()
    assert db_commit.committed is True

    db_rollback = _FakeSession()
    monkeypatch.setattr(db_module, "SessionLocal", lambda: _FakeSessionContext(db_rollback))
    gen = db_module.get_db()
    _ = await gen.__anext__()
    with pytest.raises(RuntimeError):
        await gen.athrow(RuntimeError("boom"))
    assert db_rollback.rolled_back is True


class _FakeConn:
    def __init__(self):
        self.ran_sync = False

    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False

    async def run_sync(self, _fn):
        self.ran_sync = True


class _FakeEngine:
    def __init__(self, conn):
        self.conn = conn

    def begin(self):
        return self.conn


@pytest.mark.asyncio
async def test_startup_respects_auto_create_schema(monkeypatch):
    fake_conn = _FakeConn()
    monkeypatch.setattr(main_module, "engine", _FakeEngine(fake_conn))
    monkeypatch.setattr(settings, "auto_create_schema", True)
    await main_module.startup()
    assert fake_conn.ran_sync is True


def test_parse_cors_expands_localhost_and_loopback():
    expanded = main_module._parse_cors("http://localhost:3000,https://127.0.0.1:3443")
    assert "http://localhost:3000" in expanded
    assert "http://127.0.0.1:3000" in expanded
    assert "https://127.0.0.1:3443" in expanded
    assert "https://localhost:3443" in expanded


def test_local_cors_regex_enables_loopback_ports():
    assert (
        main_module._local_cors_regex("https://example.com,http://localhost:3000")
        == r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$"
    )
    assert main_module._local_cors_regex("https://example.com") is None
