"""add library policies table

Revision ID: 0005_library_policy
Revises: 0004_book_subject_rack
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0005_library_policy"
down_revision = "0004_book_subject_rack"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "library_policies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("enforce_limits", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column(
            "max_active_loans_per_user",
            sa.Integer(),
            nullable=False,
            server_default=sa.text("5"),
        ),
        sa.Column("max_loan_days", sa.Integer(), nullable=False, server_default=sa.text("21")),
        sa.Column("fine_per_day", sa.Float(), nullable=False, server_default=sa.text("2.0")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.execute(
        """
        INSERT INTO library_policies (id, enforce_limits, max_active_loans_per_user, max_loan_days, fine_per_day)
        VALUES (1, true, 5, 21, 2.0)
        ON CONFLICT (id) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("library_policies")
