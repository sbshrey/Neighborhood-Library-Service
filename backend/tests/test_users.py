import pytest


@pytest.mark.asyncio
async def test_user_crud(client, auth_headers):
    create = await client.post(
        "/users",
        json={"name": "Ada Lovelace", "email": "ada@example.com", "phone": "+1-555"},
        headers=auth_headers,
    )
    assert create.status_code == 201
    user = create.json()
    assert user["role"] == "member"

    listed = await client.get("/users", headers=auth_headers)
    assert listed.status_code == 200
    assert len(listed.json()) == 2

    fetched = await client.get(f"/users/{user['id']}", headers=auth_headers)
    assert fetched.status_code == 200
    assert fetched.json()["name"] == "Ada Lovelace"

    update = await client.patch(
        f"/users/{user['id']}",
        json={"phone": "+1-555-1234", "role": "staff"},
        headers=auth_headers,
    )
    assert update.status_code == 200
    assert update.json()["phone"] == "+1-555-1234"
    assert update.json()["role"] == "staff"


@pytest.mark.asyncio
async def test_user_search(client, auth_headers):
    await client.post(
        "/users",
        json={"name": "Grace Hopper", "email": "grace@example.com"},
        headers=auth_headers,
    )
    resp = await client.get("/users?q=Grace", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]["name"] == "Grace Hopper"
