"""Allow locally uploaded profile images.

Revision ID: c62d9e4f1a07
Revises: f31a8c4d2e90
"""
from alembic import op
import sqlalchemy as sa

revision = "c62d9e4f1a07"
down_revision = "f31a8c4d2e90"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "avatar_url",
            existing_type=sa.String(length=512),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade():
    with op.batch_alter_table("users") as batch_op:
        batch_op.alter_column(
            "avatar_url",
            existing_type=sa.Text(),
            type_=sa.String(length=512),
            existing_nullable=True,
        )
