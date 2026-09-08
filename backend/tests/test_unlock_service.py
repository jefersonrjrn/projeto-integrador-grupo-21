import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.models.enums import UnlockStatus
from app.schemas.unlock import UnlockVerifyRequest
from app.services import unlock_service


def result_with(value):
    result = MagicMock()
    result.scalar_one_or_none.return_value = value
    return result


def employee(*, locked=True):
    return SimpleNamespace(id=uuid.uuid4(), account_locked=locked)


def challenge(*, status=UnlockStatus.PENDING, attempts=0, expires_at=None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        user_id=uuid.uuid4(),
        status=status,
        attempts=attempts,
        expires_at=expires_at or datetime.now(UTC) + timedelta(minutes=5),
        code_hash="hashed-code",
        completed_at=None,
    )


def database_for(current_user, current_challenge=None):
    database = MagicMock()
    results = [result_with(current_user)]
    if current_challenge is not None:
        results.append(result_with(current_challenge))
    database.execute.side_effect = results
    return database


def test_request_uses_configured_demo_code(monkeypatch):
    current_user = employee()
    database = database_for(current_user)
    database.execute.side_effect = [result_with(current_user), MagicMock()]
    monkeypatch.setattr(
        unlock_service,
        "settings",
        SimpleNamespace(demo_mode=True, demo_unlock_code="654321"),
    )
    hash_mock = MagicMock(return_value="hash")
    monkeypatch.setattr(unlock_service, "hash_password", hash_mock)

    created, demo_code = unlock_service.request_code(database, current_user)

    assert demo_code == "654321"
    assert created.user_id == current_user.id
    assert created.status == UnlockStatus.PENDING
    hash_mock.assert_called_once_with("654321")
    database.commit.assert_called_once_with()


def test_request_omits_random_code_outside_demo(monkeypatch):
    current_user = employee()
    database = database_for(current_user)
    database.execute.side_effect = [result_with(current_user), MagicMock()]
    monkeypatch.setattr(
        unlock_service,
        "settings",
        SimpleNamespace(demo_mode=False, demo_unlock_code="123456"),
    )
    monkeypatch.setattr(unlock_service.secrets, "randbelow", lambda _limit: 42)
    hash_mock = MagicMock(return_value="hash")
    monkeypatch.setattr(unlock_service, "hash_password", hash_mock)

    _, demo_code = unlock_service.request_code(database, current_user)

    assert demo_code is None
    hash_mock.assert_called_once_with("000042")


def test_verified_code_cannot_be_reused(monkeypatch):
    current_user = employee(locked=False)
    current_challenge = challenge(status=UnlockStatus.VERIFIED)
    database = database_for(current_user, current_challenge)
    verify_mock = MagicMock()
    monkeypatch.setattr(unlock_service, "verify_password", verify_mock)

    with pytest.raises(HTTPException) as error:
        unlock_service.verify_code(database, current_user, current_challenge.id, "123456")

    assert error.value.status_code == 409
    verify_mock.assert_not_called()


def test_challenge_from_another_user_is_not_revealed():
    current_user = employee()
    database = MagicMock()
    database.execute.side_effect = [result_with(current_user), result_with(None)]

    with pytest.raises(HTTPException) as error:
        unlock_service.verify_code(database, current_user, uuid.uuid4(), "123456")

    assert error.value.status_code == 404


@pytest.mark.parametrize(
    ("attempts", "expected_status", "remaining"),
    [(3, 422, "Restam 1 tentativas"), (4, 429, "Limite de tentativas excedido")],
)
def test_invalid_code_enforces_attempt_limit(monkeypatch, attempts, expected_status, remaining):
    current_user = employee()
    current_challenge = challenge(attempts=attempts)
    database = database_for(current_user, current_challenge)
    monkeypatch.setattr(unlock_service, "verify_password", lambda *_args: False)

    with pytest.raises(HTTPException) as error:
        unlock_service.verify_code(database, current_user, current_challenge.id, "000000")

    assert error.value.status_code == expected_status
    assert remaining in error.value.detail
    assert current_challenge.attempts == attempts + 1
    if expected_status == 429:
        assert current_challenge.status == UnlockStatus.BLOCKED
    database.commit.assert_called_once_with()


def test_expired_code_is_persisted_and_returns_gone():
    current_user = employee()
    current_challenge = challenge(expires_at=datetime.now(UTC) - timedelta(seconds=1))
    database = database_for(current_user, current_challenge)

    with pytest.raises(HTTPException) as error:
        unlock_service.verify_code(database, current_user, current_challenge.id, "123456")

    assert error.value.status_code == 410
    assert current_challenge.status == UnlockStatus.EXPIRED
    database.commit.assert_called_once_with()


def test_valid_code_unlocks_account_atomically(monkeypatch):
    current_user = employee()
    current_challenge = challenge()
    database = database_for(current_user, current_challenge)
    monkeypatch.setattr(unlock_service, "verify_password", lambda *_args: True)

    result = unlock_service.verify_code(database, current_user, current_challenge.id, "123456")

    assert result is current_user
    assert current_user.account_locked is False
    assert current_challenge.status == UnlockStatus.VERIFIED
    assert current_challenge.completed_at is not None
    database.commit.assert_called_once_with()
    database.refresh.assert_called_once_with(current_user)
    user_lock = str(database.execute.call_args_list[0].args[0])
    challenge_lock = str(database.execute.call_args_list[1].args[0])
    assert "FROM users" in user_lock and "FOR UPDATE" in user_lock
    assert "FROM unlock_requests" in challenge_lock and "FOR UPDATE" in challenge_lock


@pytest.mark.parametrize("code", ["12345", "1234567", "12345A"])
def test_verification_contract_requires_six_digits(code):
    with pytest.raises(ValidationError):
        UnlockVerifyRequest(challenge_id=uuid.uuid4(), code=code)
