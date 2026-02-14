import pytest


from tests.constants import TEST_AUTH_VALUE
@pytest.mark.asyncio
async def test_member_can_view_own_loan_history_with_fines(client):
    bootstrap = await client.post(
        "/users",
        json={
            "name": "Member Admin",
            "email": "member-admin@test.dev",
            "role": "admin",
            "password": TEST_AUTH_VALUE,
        },
    )
    assert bootstrap.status_code == 201

    login_admin = await client.post(
        "/auth/login",
        json={"email": "member-admin@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_admin.status_code == 200
    admin_headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    member_resp = await client.post(
        "/users",
        json={
            "name": "Member Reader",
            "email": "member-reader@test.dev",
            "role": "member",
            "password": TEST_AUTH_VALUE,
        },
        headers=admin_headers,
    )
    assert member_resp.status_code == 201
    member_id = member_resp.json()["id"]

    book_resp = await client.post(
        "/books",
        json={"title": "Member Book", "author": "Member Author", "copies_total": 2},
        headers=admin_headers,
    )
    assert book_resp.status_code == 201
    book_id = book_resp.json()["id"]

    loan_active = await client.post(
        "/loans/borrow",
        json={"book_id": book_id, "user_id": member_id, "days": 7},
        headers=admin_headers,
    )
    assert loan_active.status_code == 201

    loan_to_return = await client.post(
        "/loans/borrow",
        json={"book_id": book_id, "user_id": member_id, "days": 7},
        headers=admin_headers,
    )
    assert loan_to_return.status_code == 201

    return_resp = await client.post(
        f"/loans/{loan_to_return.json()['id']}/return",
        headers=admin_headers,
    )
    assert return_resp.status_code == 200

    login_member = await client.post(
        "/auth/login",
        json={"email": "member-reader@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_member.status_code == 200
    member_headers = {"Authorization": f"Bearer {login_member.json()['access_token']}"}

    my_loans = await client.get("/users/me/loans", headers=member_headers)
    assert my_loans.status_code == 200
    data = my_loans.json()
    assert len(data) == 2
    assert all(item["user_id"] == member_id for item in data)
    assert all(item["book_title"] == "Member Book" for item in data)
    assert any(item["returned_at"] is None for item in data)
    assert any(item["returned_at"] is not None for item in data)
    assert all("fine_due" in item for item in data)
    assert all("fine_paid" in item for item in data)

    my_payments = await client.get("/users/me/fine-payments", headers=member_headers)
    assert my_payments.status_code == 200
    assert isinstance(my_payments.json(), list)
