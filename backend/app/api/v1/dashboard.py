from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.enums import UserRole
from app.schemas.ticket import DashboardEmployeeSummary, DashboardTechnicianSummary
from app.services.ticket_service import employee_dashboard, technician_dashboard

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get(
    "/summary",
    response_model=DashboardEmployeeSummary | DashboardTechnicianSummary,
)
def get_summary(
    db: Session = Depends(get_db), current_user=Depends(get_current_user)
) -> DashboardEmployeeSummary | DashboardTechnicianSummary:
    if current_user.role == UserRole.EMPLOYEE:
        return DashboardEmployeeSummary(**employee_dashboard(db, current_user))
    return DashboardTechnicianSummary(**technician_dashboard(db))
