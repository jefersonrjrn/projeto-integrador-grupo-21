from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import require_employee
from app.db.session import get_db
from app.schemas.auth import UserRead
from app.schemas.unlock import (
    UnlockRequestResponse,
    UnlockVerifyRequest,
)
from app.services.unlock_service import request_code, verify_code

router = APIRouter(prefix="/api/v1/account-unlocks", tags=["desbloqueio de conta"])


@router.post(
    "/request-code",
    response_model=UnlockRequestResponse,
    response_model_exclude_none=True,
)
def create_unlock_request(
    db: Session = Depends(get_db), current_user=Depends(require_employee)
) -> UnlockRequestResponse:
    challenge, demo_code = request_code(db, current_user)
    return UnlockRequestResponse(
        challenge_id=challenge.id, expires_at=challenge.expires_at, demo_code=demo_code
    )


@router.post("/verify", response_model=UserRead)
def verify_unlock_request(
    payload: UnlockVerifyRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_employee),
) -> UserRead:
    user = verify_code(db, current_user, payload.challenge_id, payload.code)
    return UserRead.model_validate(user)
