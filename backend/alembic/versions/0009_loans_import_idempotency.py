"""add unique key for loan import idempotency

Revision ID: 0009_loans_import_idempotency
Revises: 0008_fine_payments
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0009_loans_import_idempotency"
down_revision = "0008_fine_payments"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Backfill safety: collapse any historical duplicate loan signatures produced by
    # repeated imports before adding the unique constraint.
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    book_id,
                    user_id,
                    borrowed_at,
                    due_at,
                    returned_at,
                    FIRST_VALUE(id) OVER (
                        PARTITION BY book_id, user_id, borrowed_at, due_at
                        ORDER BY
                            CASE WHEN returned_at IS NOT NULL THEN 0 ELSE 1 END,
                            id ASC
                    ) AS keep_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY book_id, user_id, borrowed_at, due_at
                        ORDER BY
                            CASE WHEN returned_at IS NOT NULL THEN 0 ELSE 1 END,
                            id ASC
                    ) AS rn
                FROM loans
            ),
            duplicates AS (
                SELECT id, keep_id, book_id, returned_at
                FROM ranked
                WHERE rn > 1
            ),
            active_duplicates AS (
                SELECT book_id, COUNT(*) AS cnt
                FROM duplicates
                WHERE returned_at IS NULL
                GROUP BY book_id
            )
            UPDATE books b
            SET copies_available = b.copies_available + ad.cnt
            FROM active_duplicates ad
            WHERE b.id = ad.book_id
            """
        )
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    FIRST_VALUE(id) OVER (
                        PARTITION BY book_id, user_id, borrowed_at, due_at
                        ORDER BY
                            CASE WHEN returned_at IS NOT NULL THEN 0 ELSE 1 END,
                            id ASC
                    ) AS keep_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY book_id, user_id, borrowed_at, due_at
                        ORDER BY
                            CASE WHEN returned_at IS NOT NULL THEN 0 ELSE 1 END,
                            id ASC
                    ) AS rn
                FROM loans
            ),
            duplicates AS (
                SELECT id, keep_id
                FROM ranked
                WHERE rn > 1
            )
            UPDATE fine_payments fp
            SET loan_id = d.keep_id
            FROM duplicates d
            WHERE fp.loan_id = d.id
            """
        )
    )
    op.execute(
        sa.text(
            """
            WITH ranked AS (
                SELECT
                    id,
                    ROW_NUMBER() OVER (
                        PARTITION BY book_id, user_id, borrowed_at, due_at
                        ORDER BY
                            CASE WHEN returned_at IS NOT NULL THEN 0 ELSE 1 END,
                            id ASC
                    ) AS rn
                FROM loans
            )
            DELETE FROM loans l
            USING ranked r
            WHERE l.id = r.id AND r.rn > 1
            """
        )
    )

    op.create_unique_constraint(
        "uq_loans_book_user_borrowed_due",
        "loans",
        ["book_id", "user_id", "borrowed_at", "due_at"],
    )


def downgrade() -> None:
    op.drop_constraint("uq_loans_book_user_borrowed_due", "loans", type_="unique")
