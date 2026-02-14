"""add created_by and updated_by columns

Revision ID: 0007_created_updated_by
Revises: 0006_audit_logs
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0007_created_updated_by"
down_revision = "0006_audit_logs"
branch_labels = None
depends_on = None


def _add_user_ref_columns(table_name: str) -> None:
    op.add_column(table_name, sa.Column("created_by", sa.Integer(), nullable=True))
    op.add_column(table_name, sa.Column("updated_by", sa.Integer(), nullable=True))
    op.create_foreign_key(
        f"fk_{table_name}_created_by_users",
        table_name,
        "users",
        ["created_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_foreign_key(
        f"fk_{table_name}_updated_by_users",
        table_name,
        "users",
        ["updated_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(f"ix_{table_name}_created_by", table_name, ["created_by"], unique=False)
    op.create_index(f"ix_{table_name}_updated_by", table_name, ["updated_by"], unique=False)


def _drop_user_ref_columns(table_name: str) -> None:
    op.drop_index(f"ix_{table_name}_updated_by", table_name=table_name)
    op.drop_index(f"ix_{table_name}_created_by", table_name=table_name)
    op.drop_constraint(f"fk_{table_name}_updated_by_users", table_name, type_="foreignkey")
    op.drop_constraint(f"fk_{table_name}_created_by_users", table_name, type_="foreignkey")
    op.drop_column(table_name, "updated_by")
    op.drop_column(table_name, "created_by")


def upgrade() -> None:
    _add_user_ref_columns("users")
    _add_user_ref_columns("books")
    _add_user_ref_columns("loans")
    _add_user_ref_columns("library_policies")


def downgrade() -> None:
    _drop_user_ref_columns("library_policies")
    _drop_user_ref_columns("loans")
    _drop_user_ref_columns("books")
    _drop_user_ref_columns("users")
