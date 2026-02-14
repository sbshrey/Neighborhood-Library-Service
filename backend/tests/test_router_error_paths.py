import pytest
from sqlalchemy.exc import SQLAlchemyError

from app.config import settings
from app.crud.books import crud_books
from app.crud.loans import crud_loans
from app.main import login_attempts


@pytest.mark.asyncio
async def test_book_constraints_and_role_null_validation(client, auth_headers):
    book = await client.post(
        "/books",
        json={"title": "  Trim Title  ", "author": "  Trim Author  ", "copies_total": 2},
        headers=auth_headers,
    )
    assert book.status_code == 201
    assert book.json()["title"] == "Trim Title"
    assert book.json()["author"] == "Trim Author"

    user = await client.post(
        "/users",
        json={
            "name": "Constraint User",
            "email": "constraint-user@test.dev",
            "password": "member-pass-123",
        },
        headers=auth_headers,
    )
    assert user.status_code == 201

    for _ in range(2):
        borrow = await client.post(
            "/loans/borrow",
            json={"book_id": book.json()["id"], "user_id": user.json()["id"], "days": 7},
            headers=auth_headers,
        )
        assert borrow.status_code == 201

    invalid_total = await client.patch(
        f"/books/{book.json()['id']}",
        json={"copies_total": 1},
        headers=auth_headers,
    )
    assert invalid_total.status_code == 400
    assert "copies_total cannot be less than active loans" in invalid_total.json()["detail"]

    role_null = await client.patch(
        f"/users/{user.json()['id']}",
        json={"role": None},
        headers=auth_headers,
    )
    assert role_null.status_code == 422


@pytest.mark.asyncio
async def test_register_crud_integrity_and_db_error_mapping(client, auth_headers, monkeypatch):
    first = await client.post(
        "/users",
        json={
            "name": "Dup One",
            "email": "dup@test.dev",
            "password": "dup-pass-123",
        },
        headers=auth_headers,
    )
    assert first.status_code == 201

    duplicate = await client.post(
        "/users",
        json={
            "name": "Dup Two",
            "email": "dup@test.dev",
            "password": "dup-pass-123",
        },
        headers=auth_headers,
    )
    assert duplicate.status_code == 409

    second = await client.post(
        "/users",
        json={
            "name": "Dup Three",
            "email": "dup2@test.dev",
            "password": "dup-pass-123",
        },
        headers=auth_headers,
    )
    assert second.status_code == 201

    duplicate_update = await client.patch(
        f"/users/{second.json()['id']}",
        json={"email": "dup@test.dev"},
        headers=auth_headers,
    )
    assert duplicate_update.status_code == 409

    async def broken_create(*_args, **_kwargs):
        raise SQLAlchemyError("boom")

    async def invalid_create(*_args, **_kwargs):
        raise ValueError("bad payload")

    monkeypatch.setattr(crud_books, "create", invalid_create)
    value_error = await client.post(
        "/books",
        json={"title": "Bad", "author": "Payload", "copies_total": 1},
        headers=auth_headers,
    )
    assert value_error.status_code == 400
    assert value_error.json()["detail"] == "bad payload"

    monkeypatch.setattr(crud_books, "create", broken_create)
    db_error = await client.post(
        "/books",
        json={"title": "DB", "author": "Error", "copies_total": 1},
        headers=auth_headers,
    )
    assert db_error.status_code == 500
    assert db_error.json()["detail"] == "Database error while creating book."


@pytest.mark.asyncio
async def test_loan_router_db_error_and_seed_toggle(client, auth_headers, monkeypatch):
    async def broken_borrow(*_args, **_kwargs):
        raise SQLAlchemyError("db down")

    monkeypatch.setattr(crud_loans, "borrow", broken_borrow)
    borrow_error = await client.post(
        "/loans/borrow",
        json={"book_id": 1, "user_id": 1, "days": 7},
        headers=auth_headers,
    )
    assert borrow_error.status_code == 500
    assert borrow_error.json()["detail"] == "Database error while borrowing book."

    monkeypatch.setattr(settings, "enable_seed", False)
    seed_disabled = await client.post("/seed", headers=auth_headers)
    assert seed_disabled.status_code == 403
    assert seed_disabled.json()["detail"] == "Seeding is disabled"


@pytest.mark.asyncio
async def test_login_invalid_password_and_rate_limit(client):
    create = await client.post(
        "/users",
        json={
            "name": "Login User",
            "email": "login-user@test.dev",
            "role": "admin",
            "password": "valid-pass-123",
        },
    )
    assert create.status_code == 201

    invalid = await client.post(
        "/auth/login",
        json={"email": "login-user@test.dev", "password": "wrong-pass-123"},
    )
    assert invalid.status_code == 401
    assert invalid.headers.get("www-authenticate") == "Bearer"

    original_limit = settings.auth_login_rate_limit_per_window
    try:
        login_attempts.clear()
        settings.auth_login_rate_limit_per_window = 1
        first = await client.post(
            "/auth/login",
            json={"email": "login-user@test.dev", "password": "valid-pass-123"},
        )
        assert first.status_code == 200
        second = await client.post(
            "/auth/login",
            json={"email": "login-user@test.dev", "password": "valid-pass-123"},
        )
        assert second.status_code == 429
    finally:
        settings.auth_login_rate_limit_per_window = original_limit
