"""Popula dados minimos de demonstracao. Idempotente."""

from datetime import UTC, datetime, timedelta

from app.core.security import hash_password
from app.db.session import SessionLocal
from app.models.article import Article
from app.models.enums import ArticleCategory, TicketCategory, TicketPriority, TicketStatus, UserRole
from app.models.ticket import Ticket, TicketEvent
from app.models.user import User

ARTICLES = [
    dict(
        title="Como recuperar acesso a conta corporativa",
        slug="recuperar-acesso-conta",
        summary="Passos para desbloquear a conta ficticia usando o codigo temporario.",
        content="Acesse a tela de desbloqueio, solicite o codigo e informe-o em ate cinco minutos.",
        category=ArticleCategory.ACCESS,
    ),
    dict(
        title="Configurar VPN corporativa",
        slug="configurar-vpn",
        summary="Orientacoes para conectar-se a rede interna simulada.",
        content="Instale o cliente de VPN de demonstracao e utilize as credenciais ficticias fornecidas.",
        category=ArticleCategory.NETWORK,
    ),
    dict(
        title="Solicitar acesso a sistema interno",
        slug="solicitar-acesso-sistema",
        summary="Fluxo para pedir liberacao de acesso a um sistema corporativo.",
        content="Abra um chamado com categoria Acesso informando o sistema desejado e a justificativa.",
        category=ArticleCategory.ACCESS,
    ),
    dict(
        title="Problemas comuns de rede no escritorio",
        slug="problemas-rede-escritorio",
        summary="Verificacoes basicas antes de abrir um chamado de rede.",
        content="Reinicie o roteador local, verifique cabos e teste a conexao em outro ponto de rede.",
        category=ArticleCategory.NETWORK,
    ),
    dict(
        title="Instalacao de software autorizado",
        slug="instalacao-software-autorizado",
        summary="Como solicitar instalacao de programas homologados pela TI.",
        content="Consulte a lista de softwares homologados e abra um chamado de categoria Software se necessario.",
        category=ArticleCategory.SOFTWARE,
    ),
]

USERS = [
    dict(
        name="Thiago Almeida",
        email="thiago@example.test",
        password="Demo@123",
        role=UserRole.EMPLOYEE,
        account_locked=True,
    ),
    dict(
        name="Mateus Souza",
        email="mateus@example.test",
        password="Demo@123",
        role=UserRole.TECHNICIAN,
        account_locked=False,
    ),
]

TICKETS = [
    dict(
        protocol="INC-2026-0001",
        title="Nao consigo acessar o sistema de RH",
        description="Ao tentar logar no sistema de RH recebo erro de permissao negada.",
        category=TicketCategory.ACCESS,
        priority=TicketPriority.MEDIUM,
        status=TicketStatus.OPEN,
    ),
    dict(
        protocol="INC-2026-0002",
        title="VPN cai constantemente durante o dia",
        description="A conexao VPN cai a cada 20 minutos, prejudicando o trabalho remoto.",
        category=TicketCategory.NETWORK,
        priority=TicketPriority.HIGH,
        status=TicketStatus.IN_PROGRESS,
    ),
    dict(
        protocol="INC-2026-0003",
        title="Instalar leitor de PDF corporativo",
        description="Preciso do leitor de PDF homologado instalado na minha estacao.",
        category=TicketCategory.SOFTWARE,
        priority=TicketPriority.MEDIUM,
        status=TicketStatus.RESOLVED,
    ),
]


def add_ticket_history(
    db, ticket: Ticket, requester: User, technician: User, now: datetime
) -> None:
    events = [
        (None, TicketStatus.OPEN, requester.id, "Chamado aberto", ticket.created_at),
    ]
    if ticket.status in {TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED}:
        events.append(
            (
                TicketStatus.OPEN,
                TicketStatus.IN_PROGRESS,
                technician.id,
                "Atendimento iniciado",
                now - timedelta(days=1),
            )
        )
    if ticket.status == TicketStatus.RESOLVED:
        events.append(
            (
                TicketStatus.IN_PROGRESS,
                TicketStatus.RESOLVED,
                technician.id,
                "Chamado resolvido",
                ticket.resolved_at,
            )
        )

    for from_status, to_status, author_id, comment, created_at in events:
        db.add(
            TicketEvent(
                ticket_id=ticket.id,
                author_id=author_id,
                from_status=from_status,
                to_status=to_status,
                comment=comment,
                created_at=created_at,
            )
        )


def run_seed() -> None:
    db = SessionLocal()
    try:
        users_by_email: dict[str, User] = {}
        for user_data in USERS:
            user = db.query(User).filter(User.email == user_data["email"]).first()
            if user is None:
                user = User(
                    name=user_data["name"],
                    email=user_data["email"],
                    password_hash=hash_password(user_data["password"]),
                    role=user_data["role"],
                    account_locked=user_data["account_locked"],
                    is_active=True,
                )
                db.add(user)
            users_by_email[user_data["email"]] = user

        db.commit()

        for article_data in ARTICLES:
            exists = db.query(Article).filter(Article.slug == article_data["slug"]).first()
            if exists is None:
                db.add(Article(is_published=True, **article_data))
        db.commit()

        thiago = users_by_email["thiago@example.test"]
        mateus = users_by_email["mateus@example.test"]
        now = datetime.now(UTC)
        for offset, ticket_data in enumerate(TICKETS):
            exists = db.query(Ticket).filter(Ticket.protocol == ticket_data["protocol"]).first()
            if exists is not None:
                continue

            ticket = Ticket(
                requester_id=thiago.id,
                assignee_id=mateus.id if ticket_data["status"] != TicketStatus.OPEN else None,
                created_at=now - timedelta(days=3 - offset),
                updated_at=now - timedelta(days=1),
                resolved_at=now - timedelta(hours=2)
                if ticket_data["status"] == TicketStatus.RESOLVED
                else None,
                **ticket_data,
            )
            db.add(ticket)
            db.flush()
            add_ticket_history(db, ticket, thiago, mateus, now)

        db.commit()

        print("Seed executado com sucesso.")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
