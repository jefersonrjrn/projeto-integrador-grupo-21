# Desenvolvimento local

Use Python 3.14, uv, Node.js 24 e Docker Compose. Os lockfiles versionados
definem as dependências reproduzíveis: `uv sync --locked --extra dev` no backend
e `npm ci` no frontend. Não use ambientes Python globais.

## Configuração

Existem três arquivos locais, criados a partir do exemplo na mesma pasta:

- `.env`: somente PostgreSQL do Compose.
- `backend/.env`: conexão da API, segredo JWT e CORS.
- `frontend/.env`: `VITE_API_URL=http://localhost:8000`, sem `/api/v1`.

No Linux/macOS, copie os exemplos somente se o destino não existir:

```bash
test -f .env || cp .env.example .env
test -f backend/.env || cp backend/.env.example backend/.env
test -f frontend/.env || cp frontend/.env.example frontend/.env
docker compose up -d --wait postgres
```

Se alterar a porta, usuário ou senha do Compose, ajuste também `DATABASE_URL`
no backend. Não reutilize senhas reais. Para gerar um segredo JWT local, use
`python -c 'import secrets; print(secrets.token_urlsafe(32))'` e salve o resultado
somente no `.env`. CORS aceita uma lista de origens separadas por vírgulas.

O serviço PostgreSQL fica exposto somente em `127.0.0.1`. Não inicie dois bancos
na mesma porta; configure `POSTGRES_PORT` quando outro projeto usar 5432.
Alterar as variáveis do Compose não troca as credenciais de um volume já criado.

## Executar

Em um terminal:

```bash
cd backend
uv sync --locked --extra dev
uv run --locked --extra dev alembic upgrade head
uv run --locked --extra dev python -m app.db.seed
uv run --locked --extra dev uvicorn app.main:app --reload
```

As migrations são a única fonte de criação e alteração do esquema. O seed pressupõe
que `alembic upgrade head` terminou com sucesso e nunca substitui uma migration.

Em outro terminal:

```bash
cd frontend
npm ci
npm run dev
```

Abra `http://localhost:5173`; Swagger em `http://localhost:8000/docs`.
`GET /health` retorna 200 quando o banco está acessível e 503 quando indisponível.

## Verificar

```bash
cd backend
uv run --locked --extra dev ruff check .
uv run --locked --extra dev ruff format --check .
uv run --locked --extra dev pytest
cd ../frontend
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
```

Os testes de fundação usam dependências simuladas e não alteram o banco local.
Os scripts `api:types` e `test:e2e` estão preparados; dependem, respectivamente,
do contrato exportado e dos cenários integrados das próximas etapas.
