from sqlalchemy import text

from app.db.session import engine

DDL = """
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'unlock_status') THEN
        CREATE TYPE unlock_status AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'BLOCKED');
    END IF;
END
$$;

CREATE TABLE IF NOT EXISTS unlock_requests (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id),
    code_hash VARCHAR(255) NOT NULL,
    status unlock_status NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts >= 0 AND attempts <= 5),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS ix_unlock_requests_user_status
    ON unlock_requests (user_id, status);
CREATE INDEX IF NOT EXISTS ix_unlock_requests_expires_at
    ON unlock_requests (expires_at);
"""


def main() -> None:
    with engine.begin() as connection:
        connection.execute(text(DDL))
    print("Esquema de desbloqueio verificado com sucesso.")


if __name__ == "__main__":
    main()
