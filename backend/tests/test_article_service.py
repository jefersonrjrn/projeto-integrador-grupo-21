import uuid
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from sqlalchemy.dialects import postgresql

from app.services.article_service import ArticleNotFoundError, upsert_feedback


def result_with(*, scalar=None):
    result = MagicMock()
    result.scalar_one_or_none.return_value = scalar
    result.scalar_one.return_value = scalar
    return result


def test_feedback_uses_atomic_upsert_for_published_article():
    article_id = uuid.uuid4()
    user_id = uuid.uuid4()
    feedback = SimpleNamespace(article_id=article_id, user_id=user_id, resolved=True)
    database = MagicMock()
    database.execute.side_effect = [
        result_with(scalar=SimpleNamespace(id=article_id, is_published=True)),
        result_with(scalar=feedback),
    ]

    result = upsert_feedback(database, article_id, user_id, True)

    statement = database.execute.call_args_list[1].args[0]
    sql = str(statement.compile(dialect=postgresql.dialect()))
    assert "ON CONFLICT" in sql
    assert "DO UPDATE SET resolved" in sql
    assert result is feedback
    database.commit.assert_called_once_with()


def test_feedback_hides_missing_or_unpublished_article():
    database = MagicMock()
    database.execute.return_value = result_with(scalar=None)

    with pytest.raises(ArticleNotFoundError):
        upsert_feedback(database, uuid.uuid4(), uuid.uuid4(), False)

    database.commit.assert_not_called()
    assert database.execute.call_count == 1
