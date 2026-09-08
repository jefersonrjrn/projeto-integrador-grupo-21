import enum


class UserRole(str, enum.Enum):
    EMPLOYEE = "EMPLOYEE"
    TECHNICIAN = "TECHNICIAN"


class ArticleCategory(str, enum.Enum):
    ACCESS = "ACCESS"
    SOFTWARE = "SOFTWARE"
    NETWORK = "NETWORK"
    HARDWARE = "HARDWARE"
    SECURITY = "SECURITY"


class TicketCategory(str, enum.Enum):
    ACCESS = "ACCESS"
    SOFTWARE = "SOFTWARE"
    NETWORK = "NETWORK"
    HARDWARE = "HARDWARE"
    SECURITY = "SECURITY"
    OTHER = "OTHER"


class TicketPriority(str, enum.Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class TicketStatus(str, enum.Enum):
    OPEN = "OPEN"
    TRIAGE = "TRIAGE"
    IN_PROGRESS = "IN_PROGRESS"
    RESOLVED = "RESOLVED"


class UnlockStatus(str, enum.Enum):
    PENDING = "PENDING"
    VERIFIED = "VERIFIED"
    EXPIRED = "EXPIRED"
    BLOCKED = "BLOCKED"
