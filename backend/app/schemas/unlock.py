import uuid
from datetime import datetime

from pydantic import BaseModel

from app.schemas.auth import UserRead


class UnlockRequestResponse(BaseModel):
    challenge_id: uuid.UUID
    expires_at: datetime
    demo_code: str | None = None


class UnlockVerifyRequest(BaseModel):
    challenge_id: uuid.UUID
    code: str


class UnlockVerifyResponse(BaseModel):
    user: UserRead
