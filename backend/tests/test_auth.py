import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from pydantic import ValidationError

from app.api.deps import get_current_user, require_employee, require_technician
from app.core.security import create_access_token
from app.main import app
from app.models.enums import UserRole
from app.schemas.auth import LoginRequest


def user(role: UserRole = UserRole.EMPLOYEE, *, active: bool = True):
    return SimpleNamespace(id=uuid.uuid4(), role=role, is_active=active)


def database_returning(current_user):
    database = MagicMock()
    database.query.return_value.filter.return_value.first.return_value = current_user
    return database


def credentials_for(current_user, *, role: UserRole | None = None):
    token, _ = create_access_token(current_user.id, (role or current_user.role).value)
    return HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)


def test_current_user_accepts_valid_bearer_token():
    current_user = user()
    result = get_current_user(credentials_for(current_user), database_returning(current_user))
    assert result is current_user


@pytest.mark.parametrize("case", ["missing", "invalid", "role-mismatch", "inactive"])
def test_current_user_rejects_invalid_sessions(case):
    current_user = user(active=case != "inactive")
    if case == "missing":
        credentials = None
    elif case == "invalid":
        credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid")
    elif case == "role-mismatch":
        credentials = credentials_for(current_user, role=UserRole.TECHNICIAN)
    else:
        credentials = credentials_for(current_user)

    with pytest.raises(HTTPException) as error:
        get_current_user(credentials, database_returning(current_user))

    assert error.value.status_code == 401
    assert error.value.headers == {"WWW-Authenticate": "Bearer"}


def test_role_dependencies_reject_the_other_profile():
    employee = user(UserRole.EMPLOYEE)
    technician = user(UserRole.TECHNICIAN)

    assert require_employee(employee) is employee
    assert require_technician(technician) is technician
    with pytest.raises(HTTPException) as employee_error:
        require_employee(technician)
    with pytest.raises(HTTPException) as technician_error:
        require_technician(employee)

    assert employee_error.value.status_code == 403
    assert technician_error.value.status_code == 403


def test_openapi_documents_json_login_and_http_bearer():
    schema = app.openapi()
    security_scheme = schema["components"]["securitySchemes"]["HTTPBearer"]
    login = schema["paths"]["/api/v1/auth/login"]["post"]
    me = schema["paths"]["/api/v1/auth/me"]["get"]

    assert security_scheme["type"] == "http"
    assert security_scheme["scheme"] == "bearer"
    assert "application/json" in login["requestBody"]["content"]
    assert me["security"] == [{"HTTPBearer": []}]


def test_login_contract_rejects_invalid_email_before_database_access():
    with pytest.raises(ValidationError):
        LoginRequest(email="not-an-email", password="Demo@123")


def test_login_contract_accepts_and_normalizes_demo_email():
    payload = LoginRequest(email=" THIAGO@example.test ", password="Demo@123")
    assert payload.email == "thiago@example.test"
