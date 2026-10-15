"""Add per-user message deletion.

Revision ID: d71e4f8a2c19
Revises: c62d9e4f1a07
"""
from alembic import op
import sqlalchemy as sa

revision = "d71e4f8a2c19"
down_revision = "c62d9e4f1a07"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    if "hidden_messages" not in inspector.get_table_names():
        op.create_table(
            "hidden_messages",
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("message_id", sa.Integer(), sa.ForeignKey("messages.id", ondelete="CASCADE"), nullable=False),
            sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
            sa.UniqueConstraint("message_id", "user_id", name="uq_hidden_message_user"),
        )
    existing_indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("hidden_messages")}
    if "ix_hidden_messages_message_id" not in existing_indexes:
        op.create_index("ix_hidden_messages_message_id", "hidden_messages", ["message_id"])
    if "ix_hidden_messages_user_id" not in existing_indexes:
        op.create_index("ix_hidden_messages_user_id", "hidden_messages", ["user_id"])


def downgrade():
    op.drop_index("ix_hidden_messages_user_id", table_name="hidden_messages")
    op.drop_index("ix_hidden_messages_message_id", table_name="hidden_messages")
    op.drop_table("hidden_messages")
