"""Add singleton admin identity and project-scoped emergency access.

Revision ID: d912f360ab41
Revises: c84b2ad931f0
"""
from alembic import op
import sqlalchemy as sa


revision = "d912f360ab41"
down_revision = "c84b2ad931f0"
branch_labels = None
depends_on = None


def _table_exists(table_name):
    return sa.inspect(op.get_bind()).has_table(table_name)


def _column_exists(table_name, column_name):
    return any(
        column["name"] == column_name
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    )


def _index_exists(table_name, index_name):
    return any(
        index["name"] == index_name
        for index in sa.inspect(op.get_bind()).get_indexes(table_name)
    )


def upgrade():
    if not _column_exists("users", "is_super_admin"):
        op.add_column(
            "users",
            sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.false())
        )
    if not _index_exists("users", "ix_users_is_super_admin"):
        op.create_index("ix_users_is_super_admin", "users", ["is_super_admin"])
    if not _table_exists("emergency_access_projects"):
        op.create_table(
            "emergency_access_projects",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("request_id", sa.Integer(), nullable=False),
            sa.Column("project_id", sa.Integer(), nullable=False),
            sa.ForeignKeyConstraint(["project_id"], ["coding_projects.id"]),
            sa.ForeignKeyConstraint(["request_id"], ["emergency_access_requests.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("request_id", "project_id", name="uq_emergency_request_project"),
        )
    if not _index_exists("emergency_access_projects", "ix_emergency_access_projects_request_id"):
        op.create_index(
            "ix_emergency_access_projects_request_id",
            "emergency_access_projects",
            ["request_id"]
        )
    if not _index_exists("emergency_access_projects", "ix_emergency_access_projects_project_id"):
        op.create_index(
            "ix_emergency_access_projects_project_id",
            "emergency_access_projects",
            ["project_id"]
        )
    op.execute(sa.text(
        "UPDATE emergency_access_requests SET status = 'revoked', "
        "revoked_at = CURRENT_TIMESTAMP WHERE status = 'approved'"
    ))
    op.execute(sa.text(
        "UPDATE emergency_access_requests SET status = 'denied', "
        "reviewed_at = CURRENT_TIMESTAMP WHERE status = 'pending'"
    ))


def downgrade():
    if _table_exists("emergency_access_projects"):
        for index_name in (
            "ix_emergency_access_projects_project_id",
            "ix_emergency_access_projects_request_id",
        ):
            if _index_exists("emergency_access_projects", index_name):
                op.drop_index(index_name, table_name="emergency_access_projects")
        op.drop_table("emergency_access_projects")
    if _column_exists("users", "is_super_admin"):
        if _index_exists("users", "ix_users_is_super_admin"):
            op.drop_index("ix_users_is_super_admin", table_name="users")
        op.drop_column("users", "is_super_admin")
