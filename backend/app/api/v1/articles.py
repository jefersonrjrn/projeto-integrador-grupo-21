import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, require_employee
from app.db.session import get_db
from app.models.enums import ArticleCategory
from app.schemas.article import (
    ArticleDetail,
    ArticleFeedbackRequest,
    ArticleFeedbackResponse,
    ArticleSummary,
)
from app.services.article_service import (
    ArticleNotFoundError,
    get_article_by_slug,
    list_articles,
    upsert_feedback,
)

router = APIRouter(prefix="/api/v1/articles", tags=["base de conhecimento"])


@router.get("", response_model=list[ArticleSummary])
def get_articles(
    q: Annotated[str | None, Query(max_length=100)] = None,
    category: ArticleCategory | None = None,
    db: Session = Depends(get_db),
    _current_user=Depends(get_current_user),
) -> list[ArticleSummary]:
    articles = list_articles(db, query=q, category=category)
    return [ArticleSummary.model_validate(article) for article in articles]


@router.get("/{slug}", response_model=ArticleDetail)
def get_article(
    slug: str, db: Session = Depends(get_db), _current_user=Depends(get_current_user)
) -> ArticleDetail:
    article = get_article_by_slug(db, slug)
    if not article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Artigo nao encontrado")
    return ArticleDetail.model_validate(article)


@router.put("/{article_id}/feedback", response_model=ArticleFeedbackResponse)
def send_feedback(
    article_id: uuid.UUID,
    payload: ArticleFeedbackRequest,
    db: Session = Depends(get_db),
    current_user=Depends(require_employee),
) -> ArticleFeedbackResponse:
    try:
        feedback = upsert_feedback(
            db, article_id=article_id, user_id=current_user.id, resolved=payload.resolved
        )
    except ArticleNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Artigo nao encontrado"
        ) from exc
    return ArticleFeedbackResponse(article_id=feedback.article_id, resolved=feedback.resolved)
