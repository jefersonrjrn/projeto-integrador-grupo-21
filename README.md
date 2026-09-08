# Portal de Autoatendimento de TI

MVP acadêmico para reduzir incidentes repetitivos de suporte Nível 1. A aplicação permitirá consultar uma base de conhecimento, simular o desbloqueio seguro de uma conta, abrir e acompanhar chamados e operar uma fila técnica.

> Este projeto é uma prova de conceito. Todos os usuários, chamados e integrações são fictícios; nenhuma infraestrutura bancária real será acessada.

## Estrutura planejada

```text
.
├── backend/   # API FastAPI e migrations
├── frontend/  # SPA React com TypeScript
├── landing/   # página pública do projeto
├── database/  # DDL e modelo físico
└── docs/      # documentação da implementação
```

## Tecnologias

- Python 3.14, FastAPI, SQLAlchemy e Alembic.
- React 19 com TypeScript, Vite e Material UI.
- PostgreSQL.
- Pytest, Vitest, Testing Library e Playwright.
- Docker Compose e GitHub Actions.

## Estado

O repositório contém os fluxos iniciais de autenticação, autoajuda, desbloqueio
demonstrativo e chamados. A adequação das regras de negócio e a cobertura de
testes estão em andamento; a presença das telas não representa aceite final.

Consulte [Desenvolvimento local](docs/local-development.md) para configurar o
ambiente e executar as verificações e [Guia de testes](GUIA_DE_TESTES.md) para
as credenciais fictícias e jornadas manuais. A publicação pública ainda está pendente.

## Colaboração

Consulte [CONTRIBUTING.md](CONTRIBUTING.md) antes de iniciar uma tarefa ou abrir um pull request.
