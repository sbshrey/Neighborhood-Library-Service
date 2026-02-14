"""add change_diff to audit logs

Revision ID: 0010_audit_change_diff
Revises: 0009_loans_import_idempotency
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0010_audit_change_diff"
down_revision = "0009_loans_import_idempotency"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("audit_logs", sa.Column("change_diff", sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column("audit_logs", "change_diff")
