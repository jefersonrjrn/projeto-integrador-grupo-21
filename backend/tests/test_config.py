import pytest
from pydantic import ValidationError

from app.core.config import Settings


def test_missing_database_configuration_is_rejected(monkeypatch):
    monkeypatch.delenv("DATABASE_URL")
    with pytest.raises(ValidationError, match="database_url"):
        Settings(_env_file=None)


def test_missing_jwt_secret_is_rejected(monkeypatch):
    monkeypatch.delenv("JWT_SECRET")
    with pytest.raises(ValidationError, match="jwt_secret"):
        Settings(_env_file=None)


def test_short_secret_is_rejected():
    with pytest.raises(ValidationError, match="jwt_secret"):
        Settings(_env_file=None, jwt_secret="short")


def test_expiration_must_be_positive():
    with pytest.raises(ValidationError, match="jwt_expires_minutes"):
        Settings(_env_file=None, jwt_expires_minutes=0)


def test_cors_origins_are_normalized():
    config = Settings(
        _env_file=None, cors_origins=" http://localhost:5173, ,http://localhost:4173 "
    )
    assert config.cors_origin_list == ["http://localhost:5173", "http://localhost:4173"]


def test_demo_unlock_code_must_have_exactly_six_digits():
    with pytest.raises(ValidationError, match="demo_unlock_code"):
        Settings(_env_file=None, demo_unlock_code="12345A")
