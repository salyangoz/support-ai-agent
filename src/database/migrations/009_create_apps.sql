CREATE TABLE apps (
    id              SERIAL PRIMARY KEY,
    tenant_id       INTEGER NOT NULL REFERENCES tenants(id),
    code            VARCHAR(30) NOT NULL,
    type            VARCHAR(20) NOT NULL,
    role            VARCHAR(15) NOT NULL,
    name            VARCHAR(100),
    credentials     JSONB NOT NULL DEFAULT '{}',
    webhook_secret  VARCHAR(255),
    config          JSONB NOT NULL DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_apps_tenant ON apps(tenant_id);
CREATE INDEX idx_apps_tenant_type_role ON apps(tenant_id, type, role);
CREATE INDEX idx_apps_tenant_code ON apps(tenant_id, code);
CREATE INDEX idx_apps_tenant_active ON apps(tenant_id, is_active);
