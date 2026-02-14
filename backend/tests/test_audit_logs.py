import pytest


from tests.constants import TEST_AUTH_VALUE
@pytest.mark.asyncio
async def test_audit_logs_are_persisted_and_filterable(client):
    bootstrap = await client.post(
        "/users",
        json={
            "name": "Audit Admin",
            "email": "audit-admin@test.dev",
            "role": "admin",
            "password": TEST_AUTH_VALUE,
        },
    )
    assert bootstrap.status_code == 201

    login = await client.post(
        "/auth/login",
        json={"email": "audit-admin@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login.status_code == 200
    admin_headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

    create_book = await client.post(
        "/books",
        json={"title": "Audit Book", "author": "Audit Author", "copies_total": 1},
        headers=admin_headers,
    )
    assert create_book.status_code == 201

    logs = await client.get("/audit/logs", headers=admin_headers)
    assert logs.status_code == 200
    data = logs.json()
    assert len(data) >= 2
    assert any(item["path"] == "/books" and item["entity"] == "books" for item in data)
    assert any(item["path"] == "/users" and item["actor_user_id"] is None for item in data)

    filtered = await client.get(
        "/audit/logs?method=POST&entity=books&limit=10",
        headers=admin_headers,
    )
    assert filtered.status_code == 200
    filtered_data = filtered.json()
    assert len(filtered_data) >= 1
    assert all(item["method"] == "POST" for item in filtered_data)
    assert all(item["entity"] == "books" for item in filtered_data)


@pytest.mark.asyncio
async def test_audit_log_endpoint_is_admin_only(client):
    bootstrap_admin = await client.post(
        "/users",
        json={
            "name": "Admin User",
            "email": "admin-audit-role@test.dev",
            "role": "admin",
            "password": TEST_AUTH_VALUE,
        },
    )
    assert bootstrap_admin.status_code == 201

    login_admin = await client.post(
        "/auth/login",
        json={"email": "admin-audit-role@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_admin.status_code == 200
    admin_headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    create_staff = await client.post(
        "/users",
        json={
            "name": "Staff User",
            "email": "staff-audit-role@test.dev",
            "role": "staff",
            "password": TEST_AUTH_VALUE,
        },
        headers=admin_headers,
    )
    assert create_staff.status_code == 201

    login_staff = await client.post(
        "/auth/login",
        json={"email": "staff-audit-role@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_staff.status_code == 200
    staff_headers = {"Authorization": f"Bearer {login_staff.json()['access_token']}"}

    forbidden = await client.get("/audit/logs", headers=staff_headers)
    assert forbidden.status_code == 403
