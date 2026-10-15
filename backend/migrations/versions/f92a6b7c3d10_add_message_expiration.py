"""Add expiration timestamps to chat messages.

Revision ID: f92a6b7c3d10
Revises: e83f4a1b6c20
"""
from alembic import op
import sqlalchemy as sa


revision = "f92a6b7c3d10"
down_revision = "e83f4a1b6c20"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("messages")}
    if "expires_at" not in columns:
        op.add_column("messages", sa.Column("expires_at", sa.DateTime(), nullable=True))

    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        op.execute(
            sa.text(
                "UPDATE messages "
                "SET expires_at = datetime(created_at, '+120 seconds') "
                "WHERE expires_at IS NULL"
            )
        )
    else:
        op.execute(
            sa.text(
                "UPDATE messages "
                "SET expires_at = created_at + INTERVAL '120 seconds' "
                "WHERE expires_at IS NULL"
            )
        )

    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("messages") as batch_op:
            batch_op.alter_column("expires_at", nullable=False)
    else:
        op.alter_column("messages", "expires_at", nullable=False)
    indexes = {index["name"] for index in inspector.get_indexes("messages")}
    if "ix_messages_expires_at" not in indexes:
        op.create_index("ix_messages_expires_at", "messages", ["expires_at"])


def downgrade():
    op.drop_index("ix_messages_expires_at", table_name="messages")
    op.drop_column("messages", "expires_at")
