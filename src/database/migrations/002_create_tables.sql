-- Tenants
CREATE TABLE tenants (
    id              UUID PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    slug            VARCHAR(100) NOT NULL UNIQUE,
    api_key         VARCHAR(128) NOT NULL UNIQUE,
    settings        JSONB DEFAULT '{}',
    is_active       BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Apps
CREATE TABLE apps (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
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

-- Customers
CREATE TABLE customers (
    id              UUID PRIMARY KEY,
    tenant_id       UUID NOT NULL REFERENCES tenants(id),
    external_id     VARCHAR(128),
    email           VARCHAR(255),
    name            VARCHAR(255),
    phone           VARCHAR(50),
    metadata        JSONB DEFAULT '{}',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);

CREATE INDEX idx_customers_tenant ON customers(tenant_id);
CREATE INDEX idx_customers_external ON customers(tenant_id, external_id);

-- Tickets
CREATE TABLE tickets (
    id                  UUID PRIMARY KEY,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
    customer_id         UUID REFERENCES customers(id),
    input_app_id        UUID REFERENCES apps(id),
    output_app_id       UUID REFERENCES apps(id),
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
    UNIQUE(tenant_id, input_app_id, external_id)
);

CREATE INDEX idx_tickets_tenant_state ON tickets(tenant_id, state);
CREATE INDEX idx_tickets_customer ON tickets(customer_id);
CREATE INDEX idx_tickets_input_app ON tickets(input_app_id);
CREATE INDEX idx_tickets_output_app ON tickets(output_app_id);

-- Messages
CREATE TABLE messages (
    id                  UUID PRIMARY KEY,
    ticket_id           UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
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

-- Knowledge articles
CREATE TABLE knowledge_articles (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    title       VARCHAR(500) NOT NULL,
    content     TEXT NOT NULL,
    category    VARCHAR(100),
    language    VARCHAR(10) DEFAULT 'tr',
    embedding   vector(1536),
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_kb_tenant_active ON knowledge_articles(tenant_id, is_active);

-- Drafts
CREATE TABLE drafts (
    id                  UUID PRIMARY KEY,
    ticket_id           UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    tenant_id           UUID NOT NULL REFERENCES tenants(id),
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

-- Users
CREATE TABLE users (
    id              UUID PRIMARY KEY,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    name            VARCHAR(255) NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- Tenant users (many-to-many)
CREATE TABLE tenant_users (
    id          UUID PRIMARY KEY,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    user_id     UUID NOT NULL REFERENCES users(id),
    role        VARCHAR(20) NOT NULL DEFAULT 'member',
    is_active   BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_tenant_users_tenant_user ON tenant_users(tenant_id, user_id);
CREATE INDEX idx_tenant_users_tenant ON tenant_users(tenant_id);
CREATE INDEX idx_tenant_users_user ON tenant_users(user_id);
