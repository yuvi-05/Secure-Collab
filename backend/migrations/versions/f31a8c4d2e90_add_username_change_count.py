"""Track username changes.

Revision ID: f31a8c4d2e90
Revises: e14a9c7b2d11
"""
from alembic import op
import sqlalchemy as sa

revision = "f31a8c4d2e90"
down_revision = "e14a9c7b2d11"
branch_labels = None
depends_on = None


def _column_exists(table_name, column_name):
    return any(column["name"] == column_name for column in sa.inspect(op.get_bind()).get_columns(table_name))


def upgrade():
    if not _column_exists("users", "username_changes_count"):
        op.add_column(
            "users",
            sa.Column("username_changes_count", sa.Integer(), nullable=False, server_default="0"),
        )


def downgrade():
    if _column_exists("users", "username_changes_count"):
        op.drop_column("users", "username_changes_count")
