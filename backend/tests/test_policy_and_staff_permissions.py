import pytest


from tests.constants import TEST_AUTH_VALUE
@pytest.mark.asyncio
async def test_policy_enforcement_configuration(client, auth_headers):
    current = await client.get("/settings/policy", headers=auth_headers)
    assert current.status_code == 200
    assert current.json()["enforce_limits"] is True

    updated = await client.put(
        "/settings/policy",
        json={
            "enforce_limits": True,
            "max_active_loans_per_user": 2,
            "max_loan_days": 5,
            "fine_per_day": 7.5,
        },
        headers=auth_headers,
    )
    assert updated.status_code == 200
    assert updated.json()["max_loan_days"] == 5
    assert updated.json()["fine_per_day"] == 7.5

    book_resp = await client.post(
        "/books",
        json={"title": "Policy Book", "author": "Policy Author", "copies_total": 2},
        headers=auth_headers,
    )
    user_resp = await client.post(
        "/users",
        json={"name": "Policy Member", "email": "policy-member@test.dev"},
        headers=auth_headers,
    )
    assert book_resp.status_code == 201
    assert user_resp.status_code == 201

    denied = await client.post(
        "/loans/borrow",
        json={"book_id": book_resp.json()["id"], "user_id": user_resp.json()["id"], "days": 7},
        headers=auth_headers,
    )
    assert denied.status_code == 400
    assert "cannot exceed 5 days" in denied.json()["detail"]

    disable = await client.put(
        "/settings/policy",
        json={
            "enforce_limits": False,
            "max_active_loans_per_user": 2,
            "max_loan_days": 5,
            "fine_per_day": 7.5,
        },
        headers=auth_headers,
    )
    assert disable.status_code == 200
    assert disable.json()["enforce_limits"] is False

    allowed = await client.post(
        "/loans/borrow",
        json={"book_id": book_resp.json()["id"], "user_id": user_resp.json()["id"], "days": 20},
        headers=auth_headers,
    )
    assert allowed.status_code == 201


@pytest.mark.asyncio
async def test_staff_user_management_permissions(client, auth_headers):
    create_staff = await client.post(
        "/users",
        json={
            "name": "Desk Staff",
            "email": "desk-staff@test.dev",
            "role": "staff",
            "password": TEST_AUTH_VALUE,
        },
        headers=auth_headers,
    )
    assert create_staff.status_code == 201

    login_staff = await client.post(
        "/auth/login",
        json={"email": "desk-staff@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_staff.status_code == 200
    staff_headers = {"Authorization": f"Bearer {login_staff.json()['access_token']}"}

    create_member = await client.post(
        "/users",
        json={
            "name": "Walk In Member",
            "email": "walk-in@test.dev",
            "role": "member",
        },
        headers=staff_headers,
    )
    assert create_member.status_code == 201

    member_id = create_member.json()["id"]
    update_member = await client.patch(
        f"/users/{member_id}",
        json={"phone": "9999999999"},
        headers=staff_headers,
    )
    assert update_member.status_code == 200
    assert update_member.json()["phone"] == "9999999999"

    promote_member = await client.patch(
        f"/users/{member_id}",
        json={"role": "admin"},
        headers=staff_headers,
    )
    assert promote_member.status_code == 403

    create_admin = await client.post(
        "/users",
        json={
            "name": "Unauthorized Admin",
            "email": "unauthorized-admin@test.dev",
            "role": "admin",
            "password": TEST_AUTH_VALUE,
        },
        headers=staff_headers,
    )
    assert create_admin.status_code == 403

    edit_bootstrap_admin = await client.patch(
        "/users/1",
        json={"phone": "1111111111"},
        headers=staff_headers,
    )
    assert edit_bootstrap_admin.status_code == 403

    update_policy = await client.put(
        "/settings/policy",
        json={
            "enforce_limits": True,
            "max_active_loans_per_user": 5,
            "max_loan_days": 21,
            "fine_per_day": 2.0,
        },
        headers=staff_headers,
    )
    assert update_policy.status_code == 403
