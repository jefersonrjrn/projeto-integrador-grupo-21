import uuid
from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import TicketCategory, TicketPriority, TicketStatus


class TicketCreate(BaseModel):
    title: str = Field(min_length=5, max_length=160)
    description: str = Field(min_length=10, max_length=2000)
    category: TicketCategory


class UserRef(BaseModel):
    id: uuid.UUID
    name: str


class TicketEventRead(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    from_status: TicketStatus | None
    to_status: TicketStatus
    comment: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class TicketSummary(BaseModel):
    id: uuid.UUID
    protocol: str
    title: str
    category: TicketCategory
    priority: TicketPriority
    status: TicketStatus
    requester: UserRef
    assignee: UserRef | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class TicketDetail(TicketSummary):
    description: str
    events: list[TicketEventRead] = []


class TicketAssignmentUpdate(BaseModel):
    assignee_id: uuid.UUID


class TicketPriorityUpdate(BaseModel):
    priority: TicketPriority


class TicketStatusUpdate(BaseModel):
    status: TicketStatus
    comment: str | None = Field(default=None, max_length=500)


class DashboardEmployeeSummary(BaseModel):
    account_locked: bool
    open_tickets: int
    in_progress_tickets: int
    resolved_tickets: int


class DashboardTechnicianSummary(BaseModel):
    unassigned_tickets: int
    by_status: dict[str, int]
    by_priority: dict[str, int]
