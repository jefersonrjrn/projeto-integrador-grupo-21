import uuid

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models.article import Article, ArticleFeedback
from app.models.enums import ArticleCategory


def list_articles(
    db: Session, query: str | None, category: ArticleCategory | None
) -> list[Article]:
    stmt = db.query(Article).filter(Article.is_published.is_(True))

    if category:
        stmt = stmt.filter(Article.category == category)

    if query:
        term = f"%{query.lower()}%"
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
    feedback = (
        db.query(ArticleFeedback)
        .filter(ArticleFeedback.article_id == article_id, ArticleFeedback.user_id == user_id)
        .first()
    )

    if feedback:
        feedback.resolved = resolved
    else:
        feedback = ArticleFeedback(article_id=article_id, user_id=user_id, resolved=resolved)
        db.add(feedback)

    db.commit()
    db.refresh(feedback)
    return feedback
