"""add subject and rack metadata to books

Revision ID: 0004_book_subject_rack
Revises: 0003_user_password_hash
Create Date: 2026-02-14
"""

from alembic import op
import sqlalchemy as sa

revision = "0004_book_subject_rack"
down_revision = "0003_user_password_hash"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("books", sa.Column("subject", sa.String(length=120), nullable=True))
    op.add_column("books", sa.Column("rack_number", sa.String(length=64), nullable=True))
    op.create_index("ix_books_subject", "books", ["subject"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_books_subject", table_name="books")
    op.drop_column("books", "rack_number")
    op.drop_column("books", "subject")
