import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi import status as http_status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_employee, require_technician
from app.db.session import get_db
from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.schemas.ticket import (
    TicketAssignmentUpdate,
    TicketCreate,
    TicketDetail,
    TicketEventRead,
    TicketPriorityUpdate,
    TicketStatusUpdate,
    TicketSummary,
    UserRef,
)
from app.services.ticket_service import (
    assign_ticket,
    create_ticket,
    get_ticket_for_user,
    list_tickets,
    update_priority,
    update_status,
)

router = APIRouter(prefix="/api/v1/tickets", tags=["chamados"])


def _user_ref(user) -> UserRef:
    return UserRef(id=user.id, name=user.name)


def _to_summary(ticket) -> TicketSummary:
    return TicketSummary(
        id=ticket.id,
        protocol=ticket.protocol,
        title=ticket.title,
        category=ticket.category,
        priority=ticket.priority,
        status=ticket.status,
        requester=_user_ref(ticket.requester),
        assignee=_user_ref(ticket.assignee) if ticket.assignee else None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
        resolved_at=ticket.resolved_at,
    )


def _to_detail(ticket) -> TicketDetail:
    summary = _to_summary(ticket)
    events = [
        TicketEventRead(
            id=event.id,
            author_id=event.author_id,
            author=_user_ref(event.author),
            from_status=event.from_status,
            to_status=event.to_status,
            comment=event.comment,
            created_at=event.created_at,
        )
        for event in ticket.events
    ]
    return TicketDetail(**summary.model_dump(), description=ticket.description, events=events)


@router.post("", response_model=TicketDetail)
def open_ticket(
    payload: TicketCreate, db: Session = Depends(get_db), current_user=Depends(require_employee)
) -> TicketDetail:
    return _to_detail(
        create_ticket(db, current_user, payload.title, payload.description, payload.category)
    )


@router.get("", response_model=list[TicketSummary])
def get_tickets(
    ticket_status: Annotated[TicketStatus | None, Query(alias="status")] = None,
    priority: TicketPriority | None = None,
    category: TicketCategory | None = None,
    assignee_id: uuid.UUID | None = None,
    unassigned: bool = False,
    status_filter: Annotated[TicketStatus | None, Query(deprecated=True)] = None,
    priority_filter: Annotated[TicketPriority | None, Query(deprecated=True)] = None,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
) -> list[TicketSummary]:
    if ticket_status is not None and status_filter is not None:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Use apenas um dos parametros: status ou status_filter",
        )
    if priority is not None and priority_filter is not None:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Use apenas um dos parametros: priority ou priority_filter",
        )
    if assignee_id is not None and unassigned:
        raise HTTPException(
            status_code=http_status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="assignee_id e unassigned nao podem ser combinados",
        )
    return [
        _to_summary(ticket)
        for ticket in list_tickets(
            db,
            current_user,
            ticket_status or status_filter,
            priority or priority_filter,
            category,
            assignee_id,
            unassigned,
        )
    ]


@router.get("/{ticket_id}", response_model=TicketDetail)
def get_ticket(
    ticket_id: uuid.UUID, db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> TicketDetail:
    return _to_detail(get_ticket_for_user(db, ticket_id, current_user))


@router.patch("/{ticket_id}/assignment", response_model=TicketDetail)
def patch_assignment(
    ticket_id: uuid.UUID,
    payload: TicketAssignmentUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_technician),
) -> TicketDetail:
    return _to_detail(assign_ticket(db, ticket_id, payload.assignee_id, current_user))


@router.patch("/{ticket_id}/priority", response_model=TicketDetail)
def patch_priority(
    ticket_id: uuid.UUID,
    payload: TicketPriorityUpdate,
    db: Session = Depends(get_db),
    _current_user=Depends(require_technician),
) -> TicketDetail:
    return _to_detail(update_priority(db, ticket_id, payload.priority))


@router.patch("/{ticket_id}/status", response_model=TicketDetail)
def patch_status(
    ticket_id: uuid.UUID,
    payload: TicketStatusUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(require_technician),
) -> TicketDetail:
    return _to_detail(update_status(db, ticket_id, payload.status, payload.comment, current_user))
