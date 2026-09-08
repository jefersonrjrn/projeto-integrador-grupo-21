import uuid
from datetime import UTC, datetime
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import tickets as tickets_api
from app.api.v1.tickets import _to_detail
from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.schemas.ticket import TicketCreate, TicketStatusUpdate


def test_ticket_fields_are_trimmed_and_bounded():
    payload = TicketCreate(
        title="  Erro no sistema  ",
        description="  A tela apresenta erro ao salvar.  ",
        category=TicketCategory.SOFTWARE,
    )
    assert payload.title == "Erro no sistema"
    assert payload.description == "A tela apresenta erro ao salvar."

    with pytest.raises(ValidationError):
        TicketCreate(title="abcd", description="descricao valida", category="OTHER")
    with pytest.raises(ValidationError):
        TicketCreate(title="titulo valido", description="curta", category="OTHER")


def test_comment_is_trimmed_bounded_and_empty_becomes_none():
    assert TicketStatusUpdate(status="OPEN", comment="  Motivo  ").comment == "Motivo"
    assert TicketStatusUpdate(status="OPEN", comment="   ").comment is None
    with pytest.raises(ValidationError):
        TicketStatusUpdate(status="OPEN", comment="x" * 501)


def test_ticket_detail_exposes_event_author_and_resolution_date():
    author = SimpleNamespace(id=uuid.uuid4(), name="Mateus")
    requester = SimpleNamespace(id=uuid.uuid4(), name="Thiago")
    now = datetime.now(UTC)
    event = SimpleNamespace(
        id=uuid.uuid4(),
        author_id=author.id,
        author=author,
        from_status=TicketStatus.IN_PROGRESS,
        to_status=TicketStatus.RESOLVED,
        comment="Resolvido",
        created_at=now,
    )
    ticket = SimpleNamespace(
        id=uuid.uuid4(),
        protocol="INC-2026-0042",
        title="Erro no sistema",
        description="A tela apresenta erro ao salvar.",
        category=TicketCategory.SOFTWARE,
        priority=TicketPriority.MEDIUM,
        status=TicketStatus.RESOLVED,
        requester=requester,
        assignee=author,
        created_at=now,
        updated_at=now,
        resolved_at=now,
        events=[event],
    )

    result = _to_detail(ticket)

    assert result.resolved_at == now
    assert result.events[0].author_id == author.id
    assert result.events[0].author.name == "Mateus"


@pytest.mark.parametrize(
    "parameters",
    [
        {"ticket_status": TicketStatus.OPEN, "status_filter": TicketStatus.TRIAGE},
        {
            "priority": TicketPriority.HIGH,
            "priority_filter": TicketPriority.MEDIUM,
        },
        {"assignee_id": uuid.uuid4(), "unassigned": True},
    ],
)
def test_conflicting_filters_return_validation_error(parameters):
    defaults = {
        "ticket_status": None,
        "priority": None,
        "category": None,
        "assignee_id": None,
        "unassigned": False,
        "status_filter": None,
        "priority_filter": None,
        "db": MagicMock(),
        "current_user": SimpleNamespace(id=uuid.uuid4()),
    }
    with pytest.raises(HTTPException) as error:
        tickets_api.get_tickets(**(defaults | parameters))
    assert error.value.status_code == 422


def test_legacy_filters_are_forwarded_when_canonical_names_are_absent(monkeypatch):
    list_mock = MagicMock(return_value=[])
    monkeypatch.setattr(tickets_api, "list_tickets", list_mock)
    database = MagicMock()
    current_user = SimpleNamespace(id=uuid.uuid4())

    result = tickets_api.get_tickets(
        ticket_status=None,
        priority=None,
        category=TicketCategory.NETWORK,
        assignee_id=None,
        unassigned=True,
        status_filter=TicketStatus.OPEN,
        priority_filter=TicketPriority.HIGH,
        db=database,
        current_user=current_user,
    )

    assert result == []
    list_mock.assert_called_once_with(
        database,
        current_user,
        TicketStatus.OPEN,
        TicketPriority.HIGH,
        TicketCategory.NETWORK,
        None,
        True,
    )
