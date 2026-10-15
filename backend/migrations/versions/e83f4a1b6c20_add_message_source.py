"""Link mirrored personal-workspace messages.

Revision ID: e83f4a1b6c20
Revises: d71e4f8a2c19
"""
from alembic import op
import sqlalchemy as sa

revision = "e83f4a1b6c20"
down_revision = "d71e4f8a2c19"
branch_labels = None
depends_on = None


def upgrade():
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("messages")}
    if "source_message_id" not in columns:
        op.add_column("messages", sa.Column("source_message_id", sa.Integer(), nullable=True))
    indexes = {index["name"] for index in sa.inspect(op.get_bind()).get_indexes("messages")}
    if "ix_messages_source_message_id" not in indexes:
        op.create_index("ix_messages_source_message_id", "messages", ["source_message_id"])


def downgrade():
    op.drop_index("ix_messages_source_message_id", table_name="messages")
    op.drop_column("messages", "source_message_id")
