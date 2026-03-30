CREATE TABLE messages (
    id                  SERIAL PRIMARY KEY,
    ticket_id           INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id),
    external_id         VARCHAR(128) NOT NULL,
    author_role         VARCHAR(20) NOT NULL,
    author_id           VARCHAR(64),
    author_name         VARCHAR(255),
    body                TEXT,
    embedding           vector(1536),
    external_created_at TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(ticket_id, external_id)
);
CREATE INDEX idx_messages_ticket ON messages(ticket_id);
CREATE INDEX idx_messages_tenant ON messages(tenant_id);
