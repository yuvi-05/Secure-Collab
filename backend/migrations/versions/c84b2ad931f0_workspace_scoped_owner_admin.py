"""Move administration into workspaces and preserve requested emergency roles.

Revision ID: c84b2ad931f0
Revises: a71e45c9d210
Create Date: 2026-10-16
"""
from alembic import op
import sqlalchemy as sa


revision = "c84b2ad931f0"
down_revision = "a71e45c9d210"
branch_labels = None
depends_on = None


def _column_exists(table_name, column_name):
    return any(
        column["name"] == column_name
        for column in sa.inspect(op.get_bind()).get_columns(table_name)
    )


def _table_exists(table_name):
    return sa.inspect(op.get_bind()).has_table(table_name)


def upgrade():
    if not _column_exists("workspace_members", "is_active"):
        op.add_column(
            "workspace_members",
            sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true())
        )
    if not _column_exists("emergency_access_requests", "requested_role"):
        op.add_column(
            "emergency_access_requests",
            sa.Column("requested_role", sa.String(length=20), nullable=False, server_default="project_manager")
        )

    if not _table_exists("workspace_settings"):
        op.create_table(
            "workspace_settings",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("workspace_id", sa.Integer(), nullable=False),
            sa.Column("key", sa.String(length=80), nullable=False),
            sa.Column("value", sa.String(length=255), nullable=False),
            sa.Column("updated_by", sa.Integer(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
            sa.ForeignKeyConstraint(["updated_by"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
            sa.UniqueConstraint("workspace_id", "key", name="uq_workspace_setting_key"),
        )
    if not _table_exists("workspace_audit_logs"):
        op.create_table(
            "workspace_audit_logs",
            sa.Column("id", sa.Integer(), nullable=False),
            sa.Column("workspace_id", sa.Integer(), nullable=False),
            sa.Column("actor_id", sa.Integer(), nullable=False),
            sa.Column("action", sa.String(length=80), nullable=False),
            sa.Column("target_type", sa.String(length=40), nullable=False),
            sa.Column("target_id", sa.String(length=80), nullable=False),
            sa.Column("details", sa.Text(), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False),
            sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
            sa.ForeignKeyConstraint(["actor_id"], ["users.id"]),
            sa.PrimaryKeyConstraint("id"),
        )
    for table_name, index_name, column_name in [
        ("workspace_settings", "ix_workspace_settings_workspace_id", "workspace_id"),
        ("workspace_audit_logs", "ix_workspace_audit_logs_workspace_id", "workspace_id"),
        ("workspace_audit_logs", "ix_workspace_audit_logs_actor_id", "actor_id"),
        ("workspace_audit_logs", "ix_workspace_audit_logs_action", "action"),
        ("workspace_audit_logs", "ix_workspace_audit_logs_created_at", "created_at"),
    ]:
        indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes(table_name)}
        if index_name not in indexes:
            op.create_index(index_name, table_name, [column_name], unique=False)

    if _table_exists("platform_settings"):
        connection = op.get_bind()
        old_setting = connection.execute(
            sa.text("SELECT value, updated_by, updated_at FROM platform_settings WHERE key = :key"),
            {"key": "emergency_access_max_hours"},
        ).first()
        if old_setting:
            connection.execute(
                sa.text(
                    "INSERT INTO workspace_settings (workspace_id, key, value, updated_by, updated_at) "
                    "SELECT id, :key, :value, :updated_by, :updated_at FROM workspaces "
                    "WHERE NOT EXISTS (SELECT 1 FROM workspace_settings s "
                    "WHERE s.workspace_id = workspaces.id AND s.key = :key)"
                ),
                {
                    "key": "emergency_access_max_hours",
                    "value": old_setting.value,
                    "updated_by": old_setting.updated_by,
                    "updated_at": old_setting.updated_at,
                },
            )
        op.drop_table("platform_settings")

    if _table_exists("platform_audit_logs"):
        connection = op.get_bind()
        legacy_logs = sa.Table(
            "platform_audit_logs", sa.MetaData(), autoload_with=connection
        )
        workspace_logs = sa.Table(
            "workspace_audit_logs", sa.MetaData(), autoload_with=connection
        )
        for event in connection.execute(sa.select(legacy_logs)).mappings():
            workspace_ids = []
            if event["target_type"] == "project":
                try:
                    project_id = int(event["target_id"])
                except (TypeError, ValueError):
                    continue
                workspace_id = connection.execute(
                    sa.text("SELECT workspace_id FROM coding_projects WHERE id = :id"),
                    {"id": project_id},
                ).scalar()
                if workspace_id is not None:
                    workspace_ids.append(workspace_id)
            elif event["target_type"] == "user":
                try:
                    user_id = int(event["target_id"])
                except (TypeError, ValueError):
                    continue
                workspace_ids = connection.execute(
                    sa.text("SELECT workspace_id FROM workspace_members WHERE user_id = :id"),
                    {"id": user_id},
                ).scalars().all()
            elif event["target_type"] == "emergency_access_policy":
                workspace_ids = connection.execute(
                    sa.text("SELECT id FROM workspaces")
                ).scalars().all()

            for workspace_id in workspace_ids:
                connection.execute(sa.insert(workspace_logs).values(
                    workspace_id=workspace_id,
                    actor_id=event["actor_id"],
                    action=event["action"],
                    target_type=event["target_type"],
                    target_id=event["target_id"],
                    details=event["details"],
                    created_at=event["created_at"],
                ))
        op.drop_table("platform_audit_logs")

    if _column_exists("users", "is_super_admin"):
        with op.batch_alter_table("users") as batch_op:
            indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("users")}
            if "ix_users_is_super_admin" in indexes:
                batch_op.drop_index("ix_users_is_super_admin")
            batch_op.drop_column("is_super_admin")


def downgrade():
    if not _column_exists("users", "is_super_admin"):
        with op.batch_alter_table("users") as batch_op:
            batch_op.add_column(
                sa.Column("is_super_admin", sa.Boolean(), nullable=False, server_default=sa.false())
            )
            batch_op.create_index("ix_users_is_super_admin", ["is_super_admin"], unique=False)
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
        op.create_index("ix_platform_audit_logs_action", "platform_audit_logs", ["action"])
        op.create_index("ix_platform_audit_logs_actor_id", "platform_audit_logs", ["actor_id"])
        op.create_index("ix_platform_audit_logs_created_at", "platform_audit_logs", ["created_at"])
    if _table_exists("workspace_audit_logs"):
        for name in [
            "ix_workspace_audit_logs_created_at",
            "ix_workspace_audit_logs_action",
            "ix_workspace_audit_logs_actor_id",
            "ix_workspace_audit_logs_workspace_id",
        ]:
            op.drop_index(name, table_name="workspace_audit_logs")
        op.drop_table("workspace_audit_logs")
    if _table_exists("workspace_settings"):
        op.drop_index("ix_workspace_settings_workspace_id", table_name="workspace_settings")
        op.drop_table("workspace_settings")
    if _column_exists("emergency_access_requests", "requested_role"):
        with op.batch_alter_table("emergency_access_requests") as batch_op:
            batch_op.drop_column("requested_role")
    if _column_exists("workspace_members", "is_active"):
        with op.batch_alter_table("workspace_members") as batch_op:
            batch_op.drop_column("is_active")
