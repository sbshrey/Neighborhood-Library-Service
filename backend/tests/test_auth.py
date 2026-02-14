import pytest

TEST_PASSWORD = "unit-test-not-secret"


@pytest.mark.asyncio
async def test_login_and_me(client):
    create = await client.post(
        "/users",
        json={
            "name": "Bootstrap Admin",
            "email": "bootstrap@library.dev",
            "role": "admin",
            "password": TEST_PASSWORD,
        },
    )
    assert create.status_code == 201

    login = await client.post(
        "/auth/login",
        json={"email": "bootstrap@library.dev", "password": TEST_PASSWORD},
    )
    assert login.status_code == 200
    token = login.json()["access_token"]

    me = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "bootstrap@library.dev"


@pytest.mark.asyncio
async def test_protected_endpoints_require_token(client):
    response = await client.get("/books")
    assert response.status_code == 401
