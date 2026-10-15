"""Add platform roles and named workspace roles.

Revision ID: a71e45c9d210
Revises: 8b71c6f3e2a4
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


revision = "a71e45c9d210"
down_revision = "8b71c6f3e2a4"
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
    user_columns = {
        "is_super_admin": sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
        "is_active": sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    }
    for name, column in user_columns.items():
        if not _column_exists("users", name):
            op.add_column("users", column)
    for name in user_columns:
        index_name = f"ix_users_{name}"
        if not _index_exists("users", index_name):
            op.create_index(index_name, "users", [name], unique=False)

    if not _column_exists("coding_projects", "is_active"):
        op.add_column(
            "coding_projects",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
        )
    if not _index_exists("coding_projects", "ix_coding_projects_is_active"):
        op.create_index("ix_coding_projects_is_active", "coding_projects", ["is_active"], unique=False)

    if not _table_exists("platform_settings"):
        op.create_table(
            "platform_settings",
            sa.Column("key", sa.String(length=80), nullable=False),
            sa.Column("value", sa.String(length=255), nullable=False),
            sa.Column("updated_by", sa.Integer(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("key"),
        )

    if not _table_exists("platform_audit_logs"):
        op.create_table(
            "platform_audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("actor_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("target_type", sa.String(length=40), nullable=False),
            sa.Column("target_id", sa.String(length=80), nullable=False),
            sa.Column("details", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    for name, column in [
        ("ix_platform_audit_logs_action", "action"),
        ("ix_platform_audit_logs_actor_id", "actor_id"),
        ("ix_platform_audit_logs_created_at", "created_at"),
    ]:
        if not _index_exists("platform_audit_logs", name):
            op.create_index(name, "platform_audit_logs", [column], unique=False)

    op.execute(
        "UPDATE workspace_members SET role = 'owner' "
        "WHERE user_id IN (SELECT owner_id FROM workspaces)"
    )
    op.execute(
        "UPDATE workspace_members SET role = CASE "
        "WHEN role IN ('admin', 'manager') THEN 'project_manager' "
        "WHEN role = 'contributor' THEN 'developer' "
        "WHEN role = 'member' THEN 'team_member' "
        "WHEN role = 'viewer' THEN 'guest' "
        "ELSE role END"
    )
    op.execute(
        "UPDATE invitations SET role = CASE "
        "WHEN role IN ('admin', 'manager') THEN 'project_manager' "
        "WHEN role = 'contributor' THEN 'developer' "
        "WHEN role = 'member' THEN 'team_member' "
        "WHEN role = 'viewer' THEN 'guest' "
        "ELSE role END"
    )


def downgrade():
    op.execute(
        "UPDATE workspace_members SET role = CASE "
        "WHEN role IN ('owner', 'project_manager') THEN 'admin' "
        "WHEN role = 'developer' THEN 'contributor' "
        "WHEN role = 'team_member' THEN 'member' "
        "WHEN role = 'guest' THEN 'viewer' "
        "ELSE role END"
    )
    op.execute(
        "UPDATE invitations SET role = CASE "
        "WHEN role = 'project_manager' THEN 'admin' "
        "WHEN role = 'developer' THEN 'contributor' "
        "WHEN role = 'team_member' THEN 'member' "
        "WHEN role = 'guest' THEN 'viewer' "
        "ELSE role END"
    )
    with op.batch_alter_table("platform_audit_logs", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_platform_audit_logs_created_at"))
        batch_op.drop_index(batch_op.f("ix_platform_audit_logs_actor_id"))
        batch_op.drop_index(batch_op.f("ix_platform_audit_logs_action"))
    op.drop_table("platform_audit_logs")
    op.drop_table("platform_settings")
    with op.batch_alter_table("coding_projects", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_coding_projects_is_active"))
        batch_op.drop_column("is_active")
    with op.batch_alter_table("users", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_users_is_super_admin"))
        batch_op.drop_index(batch_op.f("ix_users_is_active"))
        batch_op.drop_column("is_active")
        batch_op.drop_column("is_super_admin")
