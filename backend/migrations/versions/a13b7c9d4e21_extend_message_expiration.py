"""Extend chat message expiration to one year.

Revision ID: a13b7c9d4e21
Revises: f92a6b7c3d10
"""
from alembic import op
import sqlalchemy as sa


revision = "a13b7c9d4e21"
down_revision = "f92a6b7c3d10"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            sa.text(
                "UPDATE messages "
                "SET expires_at = datetime(created_at, '+31536000 seconds')"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE messages "
                "SET expires_at = created_at + INTERVAL '1 year'"
            )
        )


def downgrade():
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            sa.text(
                "UPDATE messages "
                "SET expires_at = datetime(created_at, '+120 seconds')"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE messages "
                "SET expires_at = created_at + INTERVAL '120 seconds'"
            )
        )
