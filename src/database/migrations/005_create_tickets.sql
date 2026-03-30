CREATE TABLE tickets (
    id                  SERIAL PRIMARY KEY,
    tenant_id           INTEGER NOT NULL REFERENCES tenants(id),
    customer_id         INTEGER REFERENCES customers(id),
    provider            VARCHAR(30) NOT NULL,
    external_id         VARCHAR(128) NOT NULL,
    state               VARCHAR(20) NOT NULL DEFAULT 'open',
    subject             TEXT,
    initial_body        TEXT,
    language            VARCHAR(10),
    assignee_id         VARCHAR(64),
    external_created_at TIMESTAMPTZ,
    external_updated_at TIMESTAMPTZ,
    synced_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider, external_id)
);
CREATE INDEX idx_tickets_tenant_state ON tickets(tenant_id, state);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
