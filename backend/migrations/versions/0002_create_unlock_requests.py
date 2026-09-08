"""create unlock requests table

Revision ID: 0002_create_unlock_requests
Revises:
Create Date: 2026-09-07
"""

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "0002_create_unlock_requests"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    unlock_status = postgresql.ENUM(
        "PENDING", "VERIFIED", "EXPIRED", "BLOCKED", name="unlock_status", create_type=False
    )
    unlock_status.create(bind, checkfirst=True)
    inspector = sa.inspect(bind)
    if "unlock_requests" in inspector.get_table_names():
        return
    op.create_table(
        "unlock_requests",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("status", unlock_status, nullable=False),
        sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("attempts >= 0 AND attempts <= 5", name="ck_unlock_requests_attempts"),
    )
    op.create_index("ix_unlock_requests_user_status", "unlock_requests", ["user_id", "status"])
    op.create_index("ix_unlock_requests_expires_at", "unlock_requests", ["expires_at"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    if "unlock_requests" in inspector.get_table_names():
        op.drop_index("ix_unlock_requests_expires_at", table_name="unlock_requests")
        op.drop_index("ix_unlock_requests_user_status", table_name="unlock_requests")
        op.drop_table("unlock_requests")
