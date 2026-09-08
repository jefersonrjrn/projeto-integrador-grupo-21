import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.security import hash_password, verify_password
from app.models.enums import UnlockStatus
from app.models.unlock_request import UnlockRequest
from app.models.user import User

settings = get_settings()
CODE_TTL_MINUTES = 5
MAX_ATTEMPTS = 5


def request_code(db: Session, user: User) -> tuple[UnlockRequest, str | None]:
    if not user.account_locked:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Conta ja esta desbloqueada"
        )

    db.query(UnlockRequest).filter(
        UnlockRequest.user_id == user.id, UnlockRequest.status == UnlockStatus.PENDING
    ).update({"status": UnlockStatus.EXPIRED})

    raw_code = f"{secrets.randbelow(1_000_000):06d}"
    challenge = UnlockRequest(
        user_id=user.id,
        code_hash=hash_password(raw_code),
        status=UnlockStatus.PENDING,
        attempts=0,
        expires_at=datetime.now(UTC) + timedelta(minutes=CODE_TTL_MINUTES),
    )
    db.add(challenge)
    db.commit()
    db.refresh(challenge)

    demo_code = raw_code if settings.demo_mode else None
    return challenge, demo_code


def verify_code(db: Session, user: User, challenge_id: uuid.UUID, code: str) -> User:
    challenge = (
        db.query(UnlockRequest)
        .filter(UnlockRequest.id == challenge_id, UnlockRequest.user_id == user.id)
        .first()
    )

    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Solicitacao nao encontrada"
        )

    if challenge.status == UnlockStatus.BLOCKED:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Limite de tentativas excedido"
        )

    if challenge.expires_at < datetime.now(UTC) or challenge.status == UnlockStatus.EXPIRED:
        challenge.status = UnlockStatus.EXPIRED
        db.commit()
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Codigo expirado")

    if not verify_password(code, challenge.code_hash):
        challenge.attempts += 1
        if challenge.attempts >= MAX_ATTEMPTS:
            challenge.status = UnlockStatus.BLOCKED
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Codigo invalido"
        )

    challenge.status = UnlockStatus.VERIFIED
    challenge.completed_at = datetime.now(UTC)
    user.account_locked = False
    db.add_all([challenge, user])
    db.commit()
    db.refresh(user)
    return user
