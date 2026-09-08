"""Cria o esquema inicial completo do MVP.

Revision ID: 0001_initial_schema
Revises:
Create Date: 2026-09-08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0001_initial_schema"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

user_role = postgresql.ENUM("EMPLOYEE", "TECHNICIAN", name="user_role", create_type=False)
article_category = postgresql.ENUM(
    "ACCESS",
    "SOFTWARE",
    "NETWORK",
    "HARDWARE",
    "SECURITY",
    name="article_category",
    create_type=False,
)
ticket_category = postgresql.ENUM(
    "ACCESS",
    "SOFTWARE",
    "NETWORK",
    "HARDWARE",
    "SECURITY",
    "OTHER",
    name="ticket_category",
    create_type=False,
)
ticket_priority = postgresql.ENUM(
    "LOW", "MEDIUM", "HIGH", "CRITICAL", name="ticket_priority", create_type=False
)
ticket_status = postgresql.ENUM(
    "OPEN", "TRIAGE", "IN_PROGRESS", "RESOLVED", name="ticket_status", create_type=False
)
unlock_status = postgresql.ENUM(
    "PENDING", "VERIFIED", "EXPIRED", "BLOCKED", name="unlock_status", create_type=False
)


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    bind = op.get_bind()
    for enum in (
        user_role,
        article_category,
        ticket_category,
        ticket_priority,
        ticket_status,
        unlock_status,
    ):
        enum.create(bind, checkfirst=True)

    op.create_table(
        "users",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("role", user_role, nullable=False),
        sa.Column("account_locked", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("uq_users_email_lower", "users", [sa.text("lower(email)")], unique=True)

    op.create_table(
        "articles",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("slug", sa.String(200), nullable=False, unique=True),
        sa.Column("summary", sa.String(300), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("category", article_category, nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_articles_category", "articles", ["category"])
    op.create_index("ix_articles_is_published", "articles", ["is_published"])

    op.create_table(
        "article_feedback",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "article_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("articles.id"),
            nullable=False,
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("resolved", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("article_id", "user_id", name="uq_article_feedback_article_user"),
    )

    op.create_table(
        "unlock_requests",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("code_hash", sa.String(255), nullable=False),
        sa.Column("status", unlock_status, nullable=False),
        sa.Column("attempts", sa.SmallInteger(), nullable=False, server_default="0"),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("attempts >= 0 AND attempts <= 5", name="ck_unlock_requests_attempts"),
    )
    op.create_index("ix_unlock_requests_user_status", "unlock_requests", ["user_id", "status"])
    op.create_index("ix_unlock_requests_expires_at", "unlock_requests", ["expires_at"])

    op.create_table(
        "tickets",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("protocol", sa.String(20), nullable=False, unique=True),
        sa.Column(
            "requester_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column(
            "assignee_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=True
        ),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("category", ticket_category, nullable=False),
        sa.Column("priority", ticket_priority, nullable=False, server_default="MEDIUM"),
        sa.Column("status", ticket_status, nullable=False, server_default="OPEN"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_tickets_requester_id", "tickets", ["requester_id"])
    op.create_index("ix_tickets_assignee_id", "tickets", ["assignee_id"])
    op.create_index("ix_tickets_status", "tickets", ["status"])
    op.create_index("ix_tickets_priority", "tickets", ["priority"])
    op.create_index("ix_tickets_created_at", "tickets", ["created_at"])

    op.create_table(
        "ticket_events",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "ticket_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("tickets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "author_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id"), nullable=False
        ),
        sa.Column("from_status", ticket_status, nullable=True),
        sa.Column("to_status", ticket_status, nullable=False),
        sa.Column("comment", sa.String(500), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_index("ix_ticket_events_ticket_created", "ticket_events", ["ticket_id", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_ticket_events_ticket_created", table_name="ticket_events")
    op.drop_table("ticket_events")
    for index_name in (
        "ix_tickets_created_at",
        "ix_tickets_priority",
        "ix_tickets_status",
        "ix_tickets_assignee_id",
        "ix_tickets_requester_id",
    ):
        op.drop_index(index_name, table_name="tickets")
    op.drop_table("tickets")
    op.drop_index("ix_unlock_requests_expires_at", table_name="unlock_requests")
    op.drop_index("ix_unlock_requests_user_status", table_name="unlock_requests")
    op.drop_table("unlock_requests")
    op.drop_table("article_feedback")
    op.drop_index("ix_articles_is_published", table_name="articles")
    op.drop_index("ix_articles_category", table_name="articles")
    op.drop_table("articles")
    op.drop_index("uq_users_email_lower", table_name="users")
    op.drop_table("users")

    bind = op.get_bind()
    for enum in (
        unlock_status,
        ticket_status,
        ticket_priority,
        ticket_category,
        article_category,
        user_role,
    ):
        enum.drop(bind, checkfirst=True)
