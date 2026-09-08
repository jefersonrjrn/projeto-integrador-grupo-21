import uuid
from datetime import UTC, datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    SmallInteger,
    String,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base
from app.models.enums import UnlockStatus


class UnlockRequest(Base):
    __tablename__ = "unlock_requests"
    __table_args__ = (
        CheckConstraint("attempts >= 0 AND attempts <= 5", name="ck_unlock_requests_attempts"),
        Index("ix_unlock_requests_user_status", "user_id", "status"),
        Index("ix_unlock_requests_expires_at", "expires_at"),
        Index(
            "uq_unlock_requests_pending_user",
            "user_id",
            unique=True,
            postgresql_where=text("status = 'PENDING'::unlock_status"),
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
        server_default=text("gen_random_uuid()"),
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    code_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[UnlockStatus] = mapped_column(
        Enum(UnlockStatus, name="unlock_status"), nullable=False
    )
    attempts: Mapped[int] = mapped_column(
        SmallInteger, nullable=False, default=0, server_default="0"
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(UTC),
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
