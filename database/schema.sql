-- Modelo fisico do Portal de Autoatendimento de TI
-- Gerado a partir do documento 05-contratos-dados-e-telas.md

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE user_role AS ENUM ('EMPLOYEE', 'TECHNICIAN');
CREATE TYPE article_category AS ENUM ('ACCESS', 'SOFTWARE', 'NETWORK', 'HARDWARE', 'SECURITY');
CREATE TYPE ticket_category AS ENUM ('ACCESS', 'SOFTWARE', 'NETWORK', 'HARDWARE', 'SECURITY', 'OTHER');
CREATE TYPE ticket_priority AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
CREATE TYPE ticket_status AS ENUM ('OPEN', 'TRIAGE', 'IN_PROGRESS', 'RESOLVED');
CREATE TYPE unlock_status AS ENUM ('PENDING', 'VERIFIED', 'EXPIRED', 'BLOCKED');

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role user_role NOT NULL,
    account_locked BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_users_email_lower ON users (lower(email));

CREATE TABLE articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(180) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    summary VARCHAR(300) NOT NULL,
    content TEXT NOT NULL,
    category article_category NOT NULL,
    is_published BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_articles_category ON articles (category);
CREATE INDEX ix_articles_is_published ON articles (is_published);

CREATE TABLE article_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles (id),
    user_id UUID NOT NULL REFERENCES users (id),
    resolved BOOLEAN NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_article_feedback_article_user UNIQUE (article_id, user_id)
);

CREATE TABLE unlock_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users (id),
    code_hash VARCHAR(255) NOT NULL,
    status unlock_status NOT NULL,
    attempts SMALLINT NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 5),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX ix_unlock_requests_user_status ON unlock_requests (user_id, status);
CREATE INDEX ix_unlock_requests_expires_at ON unlock_requests (expires_at);
CREATE UNIQUE INDEX uq_unlock_requests_pending_user ON unlock_requests (user_id)
    WHERE status = 'PENDING';

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    protocol VARCHAR(20) NOT NULL UNIQUE,
    requester_id UUID NOT NULL REFERENCES users (id),
    assignee_id UUID REFERENCES users (id),
    title VARCHAR(160) NOT NULL,
    description TEXT NOT NULL,
    category ticket_category NOT NULL,
    priority ticket_priority NOT NULL DEFAULT 'MEDIUM',
    status ticket_status NOT NULL DEFAULT 'OPEN',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX ix_tickets_requester_id ON tickets (requester_id);
CREATE INDEX ix_tickets_assignee_id ON tickets (assignee_id);
CREATE INDEX ix_tickets_status ON tickets (status);
CREATE INDEX ix_tickets_priority ON tickets (priority);
CREATE INDEX ix_tickets_created_at ON tickets (created_at);

CREATE TABLE ticket_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES users (id),
    from_status ticket_status,
    to_status ticket_status NOT NULL,
    comment VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ix_ticket_events_ticket_created ON ticket_events (ticket_id, created_at);
