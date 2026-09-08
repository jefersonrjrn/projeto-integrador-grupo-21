import uuid
from datetime import UTC, datetime

from fastapi import HTTPException, status
from sqlalchemy import Integer, cast, func, select, text
from sqlalchemy.orm import Session, selectinload

from app.models.enums import TicketCategory, TicketPriority, TicketStatus, UserRole
from app.models.ticket import Ticket, TicketEvent
from app.models.user import User

VALID_TRANSITIONS = {
    TicketStatus.OPEN: {TicketStatus.TRIAGE},
    TicketStatus.TRIAGE: {TicketStatus.IN_PROGRESS, TicketStatus.OPEN},
    TicketStatus.IN_PROGRESS: {TicketStatus.RESOLVED, TicketStatus.OPEN},
    TicketStatus.RESOLVED: set(),
}

HIGH_PRIORITY_CATEGORIES = {TicketCategory.NETWORK, TicketCategory.SECURITY}
PROTOCOL_LOCK_NAMESPACE = 210021


def _with_relations(query):
    return query.options(
        selectinload(Ticket.requester),
        selectinload(Ticket.assignee),
        selectinload(Ticket.events).selectinload(TicketEvent.author),
    )


def _initial_priority(category: TicketCategory) -> TicketPriority:
    return TicketPriority.HIGH if category in HIGH_PRIORITY_CATEGORIES else TicketPriority.MEDIUM


def _generate_protocol(db: Session) -> str:
    year = datetime.now(UTC).year
    db.execute(
        text("SELECT pg_advisory_xact_lock(:namespace, :year)"),
        {"namespace": PROTOCOL_LOCK_NAMESPACE, "year": year},
    )
    sequence = (
        db.execute(
            select(func.max(cast(func.split_part(Ticket.protocol, "-", 3), Integer))).where(
                Ticket.protocol.op("~")(rf"^INC-{year}-[0-9]+$")
            )
        ).scalar_one()
        or 0
    )
    return f"INC-{year}-{sequence + 1:04d}"


def get_ticket_with_relations(db: Session, ticket_id: uuid.UUID) -> Ticket | None:
    return _with_relations(db.query(Ticket)).filter(Ticket.id == ticket_id).first()


def create_ticket(
    db: Session, requester: User, title: str, description: str, category: TicketCategory
) -> Ticket:
    ticket = Ticket(
        protocol=_generate_protocol(db),
        requester_id=requester.id,
        title=title.strip(),
        description=description.strip(),
        category=category,
        priority=_initial_priority(category),
        status=TicketStatus.OPEN,
    )
    db.add(ticket)
    db.flush()
    db.add(
        TicketEvent(
            ticket_id=ticket.id,
            author_id=requester.id,
            from_status=None,
            to_status=TicketStatus.OPEN,
            comment="Chamado aberto",
        )
    )
    db.commit()
    return get_ticket_with_relations(db, ticket.id)


def list_tickets(
    db: Session,
    user: User,
    status_filter: TicketStatus | None,
    priority_filter: TicketPriority | None,
    category: TicketCategory | None = None,
    assignee_id: uuid.UUID | None = None,
    unassigned: bool = False,
) -> list[Ticket]:
    stmt = _with_relations(db.query(Ticket))
    if user.role == UserRole.EMPLOYEE:
        stmt = stmt.filter(Ticket.requester_id == user.id)
    if status_filter:
        stmt = stmt.filter(Ticket.status == status_filter)
    if priority_filter:
        stmt = stmt.filter(Ticket.priority == priority_filter)
    if category:
        stmt = stmt.filter(Ticket.category == category)
    if assignee_id:
        stmt = stmt.filter(Ticket.assignee_id == assignee_id)
    if unassigned:
        stmt = stmt.filter(Ticket.assignee_id.is_(None), Ticket.status != TicketStatus.RESOLVED)
    return stmt.order_by(Ticket.created_at.desc()).all()


def get_ticket_for_user(db: Session, ticket_id: uuid.UUID, user: User) -> Ticket:
    ticket = get_ticket_with_relations(db, ticket_id)
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado nao encontrado")
    if user.role == UserRole.EMPLOYEE and ticket.requester_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado nao encontrado")
    return ticket


def assign_ticket(db: Session, ticket_id: uuid.UUID, assignee_id: uuid.UUID, actor: User) -> Ticket:
    if assignee_id != actor.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="O tecnico so pode assumir o proprio chamado",
        )
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).with_for_update().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado nao encontrado")
    if ticket.status == TicketStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chamado resolvido nao pode ser alterado",
        )
    if ticket.assignee_id == actor.id:
        return get_ticket_with_relations(db, ticket.id)
    if ticket.assignee_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Chamado ja possui outro responsavel",
        )
    ticket.assignee_id = actor.id
    db.commit()
    return get_ticket_with_relations(db, ticket.id)


def update_priority(db: Session, ticket_id: uuid.UUID, priority: TicketPriority) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).with_for_update().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado nao encontrado")
    if ticket.status == TicketStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Chamado resolvido nao pode ser alterado"
        )
    ticket.priority = priority
    db.commit()
    return get_ticket_with_relations(db, ticket.id)


def update_status(
    db: Session, ticket_id: uuid.UUID, new_status: TicketStatus, comment: str | None, actor: User
) -> Ticket:
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).with_for_update().first()
    if not ticket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chamado nao encontrado")
    if ticket.status == TicketStatus.RESOLVED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Chamado resolvido nao pode ser alterado"
        )
    if new_status not in VALID_TRANSITIONS.get(ticket.status, set()):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Transicao de status invalida"
        )
    if (
        new_status == TicketStatus.OPEN
        and ticket.status in {TicketStatus.TRIAGE, TicketStatus.IN_PROGRESS}
        and comment is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Comentario obrigatorio ao retornar para aberto",
        )

    previous_status = ticket.status
    ticket.status = new_status
    if new_status == TicketStatus.RESOLVED:
        ticket.resolved_at = datetime.now(UTC)
    db.add(
        TicketEvent(
            ticket_id=ticket.id,
            author_id=actor.id,
            from_status=previous_status,
            to_status=new_status,
            comment=comment.strip() if comment else None,
        )
    )
    db.commit()
    return get_ticket_with_relations(db, ticket.id)


def employee_dashboard(db: Session, user: User) -> dict:
    base = db.query(Ticket).filter(Ticket.requester_id == user.id)
    return {
        "account_locked": user.account_locked,
        "open_tickets": base.filter(Ticket.status == TicketStatus.OPEN).count(),
        "in_progress_tickets": base.filter(
            Ticket.status.in_([TicketStatus.TRIAGE, TicketStatus.IN_PROGRESS])
        ).count(),
        "resolved_tickets": base.filter(Ticket.status == TicketStatus.RESOLVED).count(),
    }


def technician_dashboard(db: Session) -> dict:
    return {
        "unassigned_tickets": db.query(Ticket)
        .filter(Ticket.assignee_id.is_(None), Ticket.status != TicketStatus.RESOLVED)
        .count(),
        "by_status": {
            item.value: db.query(Ticket).filter(Ticket.status == item).count()
            for item in TicketStatus
        },
        "by_priority": {
            item.value: db.query(Ticket).filter(Ticket.priority == item).count()
            for item in TicketPriority
        },
    }
