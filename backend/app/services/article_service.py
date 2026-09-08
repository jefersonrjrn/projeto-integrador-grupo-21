import uuid

from sqlalchemy import or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.article import Article, ArticleFeedback
from app.models.enums import ArticleCategory


class ArticleNotFoundError(Exception):
    """O artigo nao existe ou nao esta publicado."""


def list_articles(
    db: Session, query: str | None, category: ArticleCategory | None
) -> list[Article]:
    stmt = db.query(Article).filter(Article.is_published.is_(True))

    if category:
        stmt = stmt.filter(Article.category == category)

    normalized_query = query.strip() if query else None
    if normalized_query:
        term = f"%{normalized_query}%"
        stmt = stmt.filter(
            or_(
                Article.title.ilike(term),
                Article.summary.ilike(term),
                Article.content.ilike(term),
            )
        )

    return stmt.order_by(Article.title).all()


def get_article_by_slug(db: Session, slug: str) -> Article | None:
    return db.query(Article).filter(Article.slug == slug, Article.is_published.is_(True)).first()


def upsert_feedback(
    db: Session, article_id: uuid.UUID, user_id: uuid.UUID, resolved: bool
) -> ArticleFeedback:
    article = db.execute(
        select(Article)
        .where(Article.id == article_id, Article.is_published.is_(True))
        .with_for_update()
    ).scalar_one_or_none()
    if article is None:
        raise ArticleNotFoundError

    feedback_insert = insert(ArticleFeedback).values(
        article_id=article_id,
        user_id=user_id,
        resolved=resolved,
    )
    statement = feedback_insert.on_conflict_do_update(
        constraint="uq_article_feedback_article_user",
        set_={"resolved": feedback_insert.excluded.resolved},
    ).returning(ArticleFeedback)
    feedback = db.execute(statement).scalar_one()

    db.commit()
    return feedback
