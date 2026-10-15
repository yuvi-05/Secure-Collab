"""Add personal workspace flag.

Revision ID: e14a9c7b2d11
Revises: d912f360ab41
"""
from alembic import op
import sqlalchemy as sa


revision = "e14a9c7b2d11"
down_revision = "d912f360ab41"
branch_labels = None
depends_on = None


def _column_exists(table_name, column_name):
    return any(
        column["name"] == column_name
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    )


def upgrade():
    if not _column_exists("workspaces", "is_personal"):
        op.add_column(
            "workspaces",
            sa.Column("is_personal", sa.Boolean(), nullable=False, server_default=sa.false()),
        )
        op.create_index("ix_workspaces_is_personal", "workspaces", ["is_personal"])


def downgrade():
    if _column_exists("workspaces", "is_personal"):
        op.drop_index("ix_workspaces_is_personal", table_name="workspaces")
        op.drop_column("workspaces", "is_personal")
