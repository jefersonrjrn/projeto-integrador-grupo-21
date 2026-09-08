import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class UnlockRequestResponse(BaseModel):
    challenge_id: uuid.UUID
    expires_at: datetime
    demo_code: str | None = Field(default=None, pattern=r"^\d{6}$")


class UnlockVerifyRequest(BaseModel):
    challenge_id: uuid.UUID
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
