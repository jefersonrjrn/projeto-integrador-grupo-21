"""Garante somente um desbloqueio pendente por usuario.

Revision ID: 0002_unique_pending_unlock
Revises: 0001_initial_schema
Create Date: 2026-09-08
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_unique_pending_unlock"
down_revision: str | None = "0001_initial_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        WITH ranked AS (
            SELECT id,
                   row_number() OVER (
                       PARTITION BY user_id ORDER BY created_at DESC, id DESC
                   ) AS position
            FROM unlock_requests
            WHERE status = 'PENDING'::unlock_status
        )
        UPDATE unlock_requests
        SET status = 'EXPIRED'::unlock_status
        FROM ranked
        WHERE unlock_requests.id = ranked.id AND ranked.position > 1
        """
    )
    op.create_index(
        "uq_unlock_requests_pending_user",
        "unlock_requests",
        ["user_id"],
        unique=True,
        postgresql_where="status = 'PENDING'::unlock_status",
    )


def downgrade() -> None:
    op.drop_index("uq_unlock_requests_pending_user", table_name="unlock_requests")
