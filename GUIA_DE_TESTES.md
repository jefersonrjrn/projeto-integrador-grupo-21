# Guia de testes locais

Este guia explica como executar e validar o Portal de Autoatendimento de TI em ambiente local. Todos os dados, usuários e códigos descritos abaixo são fictícios e exclusivos para demonstração acadêmica.

## 1. Pré-requisitos

- Docker Desktop em execução.
- Python 3.14 e uv.
- Node.js 24 e npm.
- Git; utilize a branch da PR que deseja testar.

## 2. Preparar o backend

Na pasta raiz do projeto, suba o banco PostgreSQL:

```powershell
Copy-Item .env.example .env
docker compose up -d --wait postgres
```

Em seguida, entre na pasta `backend`, crie o arquivo local de variáveis e instale as dependências:

```powershell
cd backend
Copy-Item .env.example .env
uv sync --locked --extra dev
```

O arquivo `.env` fica apenas no computador de cada pessoa. Não o envie ao GitHub.

Crie o esquema e os dados de demonstração:

```powershell
uv run --locked --extra dev alembic upgrade head
uv run --locked --extra dev python -m app.db.seed
```

Inicie a API:

```powershell
uv run --locked --extra dev uvicorn app.main:app --reload
```

A API deve ficar disponível em `http://localhost:8000`. Para verificar, abra `http://localhost:8000/health`; a resposta esperada é `{"status":"ok"}`.

## 3. Preparar o frontend

Em outro terminal, entre na pasta `frontend` e execute:

```powershell
cd frontend
Copy-Item .env.example .env
npm ci
npm run dev
```

Abra no navegador a URL exibida pelo Vite, normalmente `http://localhost:5173`.

## 4. Usuários de demonstração

| Papel | E-mail | Senha | Uso principal |
|---|---|---|---|
| Colaborador | `thiago@example.test` | `Demo@123` | Consultar artigos, enviar feedback, abrir chamados e testar desbloqueio |
| Técnico | `mateus@example.test` | `Demo@123` | Acessar fila, assumir chamados, alterar prioridade e status |

O usuário Thiago inicia com a conta bloqueada para permitir o teste do fluxo de desbloqueio.

## 5. Checklist do colaborador

Entre como `thiago@example.test` e valide:

- Dashboard mostra o estado da conta e contagens de chamados.
- Ajuda lista artigos e permite pesquisar e filtrar por categoria.
- Digitar uma pesquisa não atualiza a lista até selecionar **Buscar** ou pressionar Enter.
- Abrir um artigo e clicar em “Sim, resolveu” exibe confirmação de feedback.
- O perfil técnico consegue consultar artigos, mas não vê os controles de feedback.
- Em “Não resolveu”, a tela de novo chamado só abre depois que o feedback for salvo;
  título e categoria chegam como sugestões editáveis.
- Clicar em “Não resolveu, abrir chamado” leva ao formulário com título e categoria preenchidos.
- Criar chamado com título entre 5 e 160 caracteres e descrição entre 10 e 2000 caracteres.
- Categoria `NETWORK` ou `SECURITY` cria chamado com prioridade inicial `HIGH`; as demais iniciam em `MEDIUM`.
- Meus chamados mostra somente chamados do Thiago.
- Detalhe do chamado exibe o evento inicial “Criado como OPEN”.

## 6. Checklist de desbloqueio

- No modo de demonstração, solicite o código e confirme que `123456` é exibido.
- O campo aceita exatamente seis dígitos e ignora outros caracteres.
- Quatro códigos incorretos retornam erro recuperável; a quinta tentativa bloqueia o desafio.
- Um código expirado ou bloqueado oferece a opção de solicitar um novo.
- Após o sucesso, o estado da conta e o dashboard são atualizados sem novo login.
- Tentar reutilizar o mesmo desafio deve retornar conflito.

Ainda como Thiago:

1. Abra “Desbloqueio de conta”.
2. Clique em “Solicitar código de verificação”.
3. Copie o código demonstrativo exibido pela aplicação.
4. Informe o código e confirme.
5. Volte ao dashboard e confirme que “Conta bloqueada” mudou para “Não”.

Em modo demo, o código aparece na interface. Não existe envio real de e-mail, SMS, VPN ou integração bancária.

## 7. Checklist do técnico

Faça logout e entre como `mateus@example.test`:

- Acesse a fila técnica de chamados.
- Abra um chamado sem responsável e assuma-o.
- Altere a prioridade, se necessário.
- Faça as transições permitidas: `OPEN -> TRIAGE -> IN_PROGRESS -> RESOLVED`.
- Verifique que cada transição aparece no histórico do chamado.
- Tente alterar um chamado em `RESOLVED`; a API deve bloquear a alteração.

## 8. Problemas comuns

| Problema | Ação |
|---|---|
| Erro de CORS | Confirme que `backend/.env` foi criado a partir de `.env.example`, reinicie a API e use a URL do Vite. |
| Uma tabela da aplicação não existe | Execute `alembic upgrade head` dentro de `backend` e confira a configuração de `DATABASE_URL`. |
| `npm` não é reconhecido | Instale Node.js, feche e abra o PowerShell novamente. |
| Porta 5173 ou 8000 ocupada | Feche processos antigos do Vite/Uvicorn ou use a URL exibida no terminal. |
| Dados antigos ou inconsistentes | Em ambiente local, pare a API e execute `docker compose down -v`, depois repita os passos das seções 2 e 3. Isso apaga somente dados locais fictícios. |

## 9. Antes de abrir PR

Execute:

```powershell
cd backend
uv run --locked --extra dev pytest
uv run --locked --extra dev ruff check .
uv run --locked --extra dev ruff format --check .
```

```powershell
cd frontend
npm run build
npm run lint
npm run typecheck
npm run format:check
npm test
```

Anexe ao pull request capturas ou gravação curta dos fluxos testados. Não faça push direto na `main`.
