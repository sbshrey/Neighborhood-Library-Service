from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import update

from app.models import Loan


from tests.constants import TEST_AUTH_VALUE


@pytest.mark.asyncio
async def test_fine_payment_collection_and_summary(client, db_session):
    bootstrap = await client.post(
        "/users",
        json={
            "name": "Fine Admin",
            "email": "fine-admin@test.dev",
            "role": "admin",
            "password": TEST_AUTH_VALUE,
        },
    )
    assert bootstrap.status_code == 201

    login_admin = await client.post(
        "/auth/login",
        json={"email": "fine-admin@test.dev", "password": TEST_AUTH_VALUE},
    )
    assert login_admin.status_code == 200
    admin_headers = {"Authorization": f"Bearer {login_admin.json()['access_token']}"}

    member = await client.post(
        "/users",
        json={
            "name": "Fine Member",
            "email": "fine-member@test.dev",
            "role": "member",
            "password": TEST_AUTH_VALUE,
        },
        headers=admin_headers,
    )
    assert member.status_code == 201

    book = await client.post(
        "/books",
        json={"title": "Fine Book", "author": "Fine Author", "copies_total": 1},
        headers=admin_headers,
    )
    assert book.status_code == 201

    borrowed = await client.post(
        "/loans/borrow",
        json={"book_id": book.json()["id"], "user_id": member.json()["id"], "days": 7},
        headers=admin_headers,
    )
    assert borrowed.status_code == 201
    loan_id = borrowed.json()["id"]

    # Force overdue fine for deterministic payment behavior in this test.
    overdue_due_at = datetime.now(timezone.utc) - timedelta(days=3)
    await db_session.execute(update(Loan).where(Loan.id == loan_id).values(due_at=overdue_due_at))
    await db_session.commit()

    summary_before = await client.get(f"/loans/{loan_id}/fine-summary", headers=admin_headers)
    assert summary_before.status_code == 200
    assert summary_before.json()["estimated_fine"] > 0
    assert summary_before.json()["fine_due"] > 0

    pay = await client.post(
        f"/loans/{loan_id}/fine-payments",
        json={"amount": 2.0, "payment_mode": "upi", "reference": "UPI-123"},
        headers=admin_headers,
    )
    assert pay.status_code == 201
    assert pay.json()["payment_mode"] == "upi"
    assert pay.json()["amount"] == 2.0

    payments = await client.get(f"/loans/{loan_id}/fine-payments", headers=admin_headers)
    assert payments.status_code == 200
    assert len(payments.json()) == 1
    assert payments.json()[0]["reference"] == "UPI-123"

    summary_after = await client.get(f"/loans/{loan_id}/fine-summary", headers=admin_headers)
    assert summary_after.status_code == 200
    assert summary_after.json()["fine_paid"] == 2.0
    assert summary_after.json()["fine_due"] >= 0

    loans_list = await client.get("/loans", headers=admin_headers)
    assert loans_list.status_code == 200
    target = next(item for item in loans_list.json() if item["id"] == loan_id)
    assert target["fine_paid"] == 2.0
    assert target["fine_due"] >= 0

    overpay = await client.post(
        f"/loans/{loan_id}/fine-payments",
        json={"amount": 999.0, "payment_mode": "cash"},
        headers=admin_headers,
    )
    assert overpay.status_code == 400
    assert "exceeds outstanding fine" in overpay.json()["detail"]

    ledger = await client.get(
        "/fine-payments",
        params={"q": "Fine Member", "payment_mode": "upi", "limit": 10},
        headers=admin_headers,
    )
    assert ledger.status_code == 200
    rows = ledger.json()
    assert len(rows) >= 1
    assert rows[0]["loan_id"] == loan_id
    assert rows[0]["user_name"] == "Fine Member"
    assert rows[0]["book_title"] == "Fine Book"
    assert rows[0]["payment_mode"] == "upi"
