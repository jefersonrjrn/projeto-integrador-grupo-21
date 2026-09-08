import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.models.ticket import Ticket, TicketEvent
from app.services import ticket_service


def technician():
    return SimpleNamespace(id=uuid.uuid4())


def ticket(*, status=TicketStatus.OPEN, assignee_id=None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        status=status,
        assignee_id=assignee_id,
        priority=TicketPriority.MEDIUM,
        resolved_at=None,
    )


def database_with_ticket(current_ticket):
    database = MagicMock()
    query = database.query.return_value
    query.filter.return_value.with_for_update.return_value.first.return_value = current_ticket
    return database


def test_protocol_uses_advisory_lock_and_maximum_sequence():
    database = MagicMock()
    maximum = MagicMock()
    maximum.scalar_one.return_value = 41
    database.execute.side_effect = [MagicMock(), maximum]

    protocol = ticket_service._generate_protocol(database)

    assert protocol.endswith("-0042")
    lock_sql = str(database.execute.call_args_list[0].args[0])
    assert "pg_advisory_xact_lock" in lock_sql


def test_creation_persists_ticket_and_initial_event_in_one_commit(monkeypatch):
    database = MagicMock()
    requester = SimpleNamespace(id=uuid.uuid4())
    loaded = SimpleNamespace(id=uuid.uuid4())
    monkeypatch.setattr(ticket_service, "_generate_protocol", lambda _db: "INC-2026-0042")
    monkeypatch.setattr(ticket_service, "get_ticket_with_relations", lambda *_args: loaded)

    result = ticket_service.create_ticket(
        database,
        requester,
        "  Falha na rede  ",
        "  Nao consigo acessar a rede corporativa.  ",
        TicketCategory.NETWORK,
    )

    created_ticket = database.add.call_args_list[0].args[0]
    created_event = database.add.call_args_list[1].args[0]
    assert isinstance(created_ticket, Ticket)
    assert created_ticket.title == "Falha na rede"
    assert created_ticket.priority == TicketPriority.HIGH
    assert isinstance(created_event, TicketEvent)
    assert created_event.to_status == TicketStatus.OPEN
    assert created_event.comment == "Chamado aberto"
    database.commit.assert_called_once_with()
    assert result is loaded


def test_assignment_is_idempotent_for_same_technician(monkeypatch):
    actor = technician()
    current_ticket = ticket(assignee_id=actor.id)
    database = database_with_ticket(current_ticket)
    loaded = SimpleNamespace(id=current_ticket.id)
    monkeypatch.setattr(ticket_service, "get_ticket_with_relations", lambda *_args: loaded)

    result = ticket_service.assign_ticket(database, current_ticket.id, actor.id, actor)

    assert result is loaded
    database.commit.assert_not_called()


def test_assignment_cannot_replace_another_technician():
    actor = technician()
    current_ticket = ticket(assignee_id=uuid.uuid4())
    database = database_with_ticket(current_ticket)

    with pytest.raises(HTTPException) as error:
        ticket_service.assign_ticket(database, current_ticket.id, actor.id, actor)

    assert error.value.status_code == 409
    database.commit.assert_not_called()


@pytest.mark.parametrize("operation", ["assignment", "priority", "status"])
def test_resolved_ticket_rejects_every_edit(operation):
    actor = technician()
    current_ticket = ticket(status=TicketStatus.RESOLVED)
    database = database_with_ticket(current_ticket)

    with pytest.raises(HTTPException) as error:
        if operation == "assignment":
            ticket_service.assign_ticket(database, current_ticket.id, actor.id, actor)
        elif operation == "priority":
            ticket_service.update_priority(database, current_ticket.id, TicketPriority.HIGH)
        else:
            ticket_service.update_status(
                database, current_ticket.id, TicketStatus.OPEN, "Reabrir", actor
            )

    assert error.value.status_code == 409


def test_invalid_transition_returns_conflict():
    actor = technician()
    current_ticket = ticket(status=TicketStatus.OPEN)
    database = database_with_ticket(current_ticket)

    with pytest.raises(HTTPException) as error:
        ticket_service.update_status(
            database, current_ticket.id, TicketStatus.RESOLVED, None, actor
        )

    assert error.value.status_code == 409


def test_return_to_open_requires_comment():
    actor = technician()
    current_ticket = ticket(status=TicketStatus.IN_PROGRESS)
    database = database_with_ticket(current_ticket)

    with pytest.raises(HTTPException) as error:
        ticket_service.update_status(database, current_ticket.id, TicketStatus.OPEN, None, actor)

    assert error.value.status_code == 422


def test_status_change_records_trimmed_comment(monkeypatch):
    actor = technician()
    current_ticket = ticket(status=TicketStatus.TRIAGE)
    database = database_with_ticket(current_ticket)
    monkeypatch.setattr(ticket_service, "get_ticket_with_relations", lambda *_args: current_ticket)

    ticket_service.update_status(
        database,
        current_ticket.id,
        TicketStatus.IN_PROGRESS,
        "  Investigando logs  ",
        actor,
    )

    event = database.add.call_args.args[0]
    assert isinstance(event, TicketEvent)
    assert event.from_status == TicketStatus.TRIAGE
    assert event.to_status == TicketStatus.IN_PROGRESS
    assert event.comment == "Investigando logs"
    assert event.author_id == actor.id
