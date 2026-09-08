import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1 import account_unlocks, articles, auth, dashboard, health, tickets
from app.core.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Portal de Autoatendimento de TI",
    description="API do MVP academico. Ambiente de demonstracao; dados e integracoes sao ficticios.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(auth.router)
app.include_router(articles.router)
app.include_router(account_unlocks.router)
app.include_router(tickets.router)
app.include_router(dashboard.router)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception) -> JSONResponse:
    logger.exception("Erro inesperado na API", extra={"path": request.url.path})
    return JSONResponse(status_code=500, content={"detail": "Erro interno do servidor"})
