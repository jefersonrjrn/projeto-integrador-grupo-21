"""Popula dados minimos de demonstracao. Idempotente."""

import uuid
from datetime import UTC, datetime, timedelta

from app.core.security import hash_password
from app.db.session import Base, SessionLocal, engine
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


def run_seed() -> None:
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        thiago = db.query(User).filter(User.email == "thiago@example.test").first()
        if not thiago:
            thiago = User(
                id=uuid.uuid4(),
                name="Thiago Almeida",
                email="thiago@example.test",
                password_hash=hash_password("Demo@123"),
                role=UserRole.EMPLOYEE,
                account_locked=True,
                is_active=True,
            )
            db.add(thiago)

        mateus = db.query(User).filter(User.email == "mateus@example.test").first()
        if not mateus:
            mateus = User(
                id=uuid.uuid4(),
                name="Mateus Souza",
                email="mateus@example.test",
                password_hash=hash_password("Demo@123"),
                role=UserRole.TECHNICIAN,
                account_locked=False,
                is_active=True,
            )
            db.add(mateus)

        db.commit()

        for article_data in ARTICLES:
            exists = db.query(Article).filter(Article.slug == article_data["slug"]).first()
            if not exists:
                db.add(Article(id=uuid.uuid4(), is_published=True, **article_data))
        db.commit()

        if db.query(Ticket).count() == 0:
            now = datetime.now(UTC)
            tickets_seed = [
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

            for offset, ticket_data in enumerate(tickets_seed):
                ticket = Ticket(
                    id=uuid.uuid4(),
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
                db.add(
                    TicketEvent(
                        id=uuid.uuid4(),
                        ticket_id=ticket.id,
                        author_id=thiago.id,
                        from_status=None,
                        to_status=TicketStatus.OPEN,
                        comment="Chamado aberto",
                        created_at=ticket.created_at,
                    )
                )
            db.commit()

        print("Seed executado com sucesso.")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
