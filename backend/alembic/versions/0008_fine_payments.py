"""create fine_payments table

Revision ID: 0008_fine_payments
Revises: 0007_created_updated_by
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0008_fine_payments"
down_revision = "0007_created_updated_by"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fine_payments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("loan_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("amount", sa.Numeric(10, 2), nullable=False),
        sa.Column("payment_mode", sa.String(length=30), nullable=False),
        sa.Column("reference", sa.String(length=120), nullable=True),
        sa.Column("notes", sa.String(length=300), nullable=True),
        sa.Column(
            "collected_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("created_by", sa.Integer(), nullable=True),
        sa.Column("updated_by", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["updated_by"], ["users.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["loan_id"], ["loans.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_fine_payments_loan_id", "fine_payments", ["loan_id"], unique=False)
    op.create_index("ix_fine_payments_user_id", "fine_payments", ["user_id"], unique=False)
    op.create_index("ix_fine_payments_collected_at", "fine_payments", ["collected_at"], unique=False)
    op.create_index("ix_fine_payments_created_by", "fine_payments", ["created_by"], unique=False)
    op.create_index("ix_fine_payments_updated_by", "fine_payments", ["updated_by"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_fine_payments_updated_by", table_name="fine_payments")
    op.drop_index("ix_fine_payments_created_by", table_name="fine_payments")
    op.drop_index("ix_fine_payments_collected_at", table_name="fine_payments")
    op.drop_index("ix_fine_payments_user_id", table_name="fine_payments")
    op.drop_index("ix_fine_payments_loan_id", table_name="fine_payments")
    op.drop_table("fine_payments")
