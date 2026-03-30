CREATE TABLE tenant_providers (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES tenants(id),
    provider        VARCHAR(30) NOT NULL,
    credentials     JSONB NOT NULL DEFAULT '{}',
    webhook_secret  VARCHAR(255),
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);
CREATE INDEX idx_tenant_providers_tenant ON tenant_providers(tenant_id);
