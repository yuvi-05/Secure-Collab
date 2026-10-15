"""Add emergency access requests and audit history.

Revision ID: 8b71c6f3e2a4
Revises: 66acc3bdd3f5
Create Date: 2026-10-15
"""
from alembic import op
import sqlalchemy as sa


revision = "8b71c6f3e2a4"
down_revision = "66acc3bdd3f5"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "emergency_access_requests",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("workspace_id", sa.Integer(), nullable=False),
        sa.Column("requester_id", sa.Integer(), nullable=False),
        sa.Column("reason", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("reviewer_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("expires_at", sa.DateTime(), nullable=True),
        sa.Column("revoked_at", sa.DateTime(), nullable=True),
        sa.Column("revoker_id", sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(["requester_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["reviewer_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["revoker_id"], ["users.id"]),
        sa.ForeignKeyConstraint(["workspace_id"], ["workspaces.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("emergency_access_requests", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_emergency_access_requests_requester_id"), ["requester_id"], unique=False)
        batch_op.create_index(batch_op.f("ix_emergency_access_requests_status"), ["status"], unique=False)
        batch_op.create_index(batch_op.f("ix_emergency_access_requests_workspace_id"), ["workspace_id"], unique=False)


def downgrade():
    with op.batch_alter_table("emergency_access_requests", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_emergency_access_requests_workspace_id"))
        batch_op.drop_index(batch_op.f("ix_emergency_access_requests_status"))
        batch_op.drop_index(batch_op.f("ix_emergency_access_requests_requester_id"))
    op.drop_table("emergency_access_requests")
