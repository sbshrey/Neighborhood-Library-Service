"""add users.password_hash

Revision ID: 0003_user_password_hash
Revises: 0002_users_role
Create Date: 2026-02-11
"""

from alembic import op
from passlib.context import CryptContext
import sqlalchemy as sa

revision = "0003_user_password_hash"
down_revision = "0002_users_role"
branch_labels = None
depends_on = None

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(length=255), nullable=True))

    default_hash = pwd_context.hash("set_local_bootstrap_password")
    op.execute(
        sa.text("UPDATE users SET password_hash = :password_hash WHERE password_hash IS NULL").bindparams(
            password_hash=default_hash
        )
    )

    op.alter_column("users", "password_hash", nullable=False)


def downgrade() -> None:
    op.drop_column("users", "password_hash")
