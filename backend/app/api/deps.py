import uuid

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.enums import UserRole
from app.models.user import User

bearer_scheme = HTTPBearer(
    auto_error=False,
    bearerFormat="JWT",
    description="Informe somente o token retornado por POST /api/v1/auth/login.",
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Sessao ausente, expirada ou invalida",
        headers={"WWW-Authenticate": "Bearer"},
    )

    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_error

    try:
        payload = decode_access_token(credentials.credentials)
        user_id = uuid.UUID(payload["sub"])
        token_role = UserRole(payload["role"])
    except (jwt.PyJWTError, KeyError, ValueError) as exc:
        raise credentials_error from exc

    user = db.query(User).filter(User.id == user_id).first()
    if not user or not user.is_active or user.role != token_role:
        raise credentials_error

    return user


def require_employee(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.EMPLOYEE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Recurso restrito a colaboradores"
        )
    return user


def require_technician(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.TECHNICIAN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail="Recurso restrito a tecnicos"
        )
    return user
