"""create books, members, loans

Revision ID: 0001_create_tables
Revises:
Create Date: 2026-02-11
"""

from alembic import op
import sqlalchemy as sa

revision = "0001_create_tables"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "books",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("author", sa.String(length=200), nullable=False),
        sa.Column("isbn", sa.String(length=32), nullable=True, unique=True),
        sa.Column("published_year", sa.Integer, nullable=True),
        sa.Column("copies_total", sa.Integer, nullable=False),
        sa.Column("copies_available", sa.Integer, nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
        ),
    )

    op.create_table(
        "members",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=200), nullable=True, unique=True),
        sa.Column("phone", sa.String(length=40), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
    )

    op.create_table(
        "loans",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("book_id", sa.Integer, nullable=False),
        sa.Column("member_id", sa.Integer, nullable=False),
        sa.Column("borrowed_at", sa.DateTime(timezone=True), server_default=sa.text("now()")),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("returned_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["book_id"], ["books.id"], name="loans_book_id_fkey"),
        sa.ForeignKeyConstraint(["member_id"], ["members.id"], name="loans_member_id_fkey"),
    )

    op.create_index(
        "idx_loans_active",
        "loans",
        ["book_id", "member_id"],
        unique=False,
        postgresql_where=sa.text("returned_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("idx_loans_active", table_name="loans")
    op.drop_table("loans")
    op.drop_table("members")
    op.drop_table("books")
