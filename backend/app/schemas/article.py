import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import ArticleCategory


class ArticleSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    summary: str
    category: ArticleCategory


class ArticleDetail(ArticleSummary):
    content: str
    updated_at: datetime


class ArticleFeedbackRequest(BaseModel):
    resolved: bool


class ArticleFeedbackResponse(BaseModel):
    article_id: uuid.UUID
    resolved: bool
