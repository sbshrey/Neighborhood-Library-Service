"""rename members to users and add role

Revision ID: 0002_users_role
Revises: 0001_create_tables
Create Date: 2026-02-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0002_users_role"
down_revision = "0001_create_tables"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.rename_table("members", "users")
    op.add_column(
        "users",
        sa.Column("role", sa.String(length=30), nullable=False, server_default="member"),
    )

    op.drop_constraint("loans_member_id_fkey", "loans", type_="foreignkey")
    op.alter_column("loans", "member_id", new_column_name="user_id")
    op.create_foreign_key("loans_user_id_fkey", "loans", "users", ["user_id"], ["id"])

    op.drop_index("idx_loans_active", table_name="loans")
    op.create_index(
        "idx_loans_active",
        "loans",
        ["book_id", "user_id"],
        unique=False,
        postgresql_where=sa.text("returned_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_loans_active", table_name="loans")
    op.create_index(
        "idx_loans_active",
        "loans",
        ["book_id", "member_id"],
        unique=False,
        postgresql_where=sa.text("returned_at IS NULL"),
    )

    op.drop_constraint("loans_user_id_fkey", "loans", type_="foreignkey")
    op.alter_column("loans", "user_id", new_column_name="member_id")
    op.create_foreign_key("loans_member_id_fkey", "loans", "members", ["member_id"], ["id"])

    op.drop_column("users", "role")
    op.rename_table("users", "members")
