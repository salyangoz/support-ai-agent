CREATE TABLE drafts (
    id                  SERIAL PRIMARY KEY,
    ticket_id           INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id),
    prompt_context      TEXT,
    draft_response      TEXT NOT NULL,
    ai_model            VARCHAR(100),
    ai_tokens_used      INTEGER,
    status              VARCHAR(20) NOT NULL DEFAULT 'pending',
    reviewed_by         VARCHAR(64),
    reviewed_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_drafts_ticket ON drafts(ticket_id);
CREATE INDEX idx_drafts_tenant_status ON drafts(tenant_id, status);
