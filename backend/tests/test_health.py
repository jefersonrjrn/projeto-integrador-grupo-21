from unittest.mock import MagicMock

from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.main import app


def request_health(error=None):
    database = MagicMock()
    database.execute.side_effect = error
    app.dependency_overrides[get_db] = lambda: database
    try:
        with TestClient(app, raise_server_exceptions=False) as client:
            return client.get("/health"), database
    finally:
        app.dependency_overrides.clear()


def test_health_checks_database():
    response, database = request_health()
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert str(database.execute.call_args.args[0]) == "SELECT 1"


def test_health_returns_503_when_database_is_unavailable():
    response, _ = request_health(OperationalError("SELECT 1", {}, Exception("private")))
    assert response.status_code == 503
    assert response.json() == {"detail": "Banco de dados indisponivel"}
    assert "private" not in response.text


def test_unexpected_error_does_not_expose_details():
    response, _ = request_health(RuntimeError("private internal detail"))
    assert response.status_code == 500
    assert response.json() == {"detail": "Erro interno do servidor"}
