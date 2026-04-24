ALTER TABLE knowledge_articles
    ADD COLUMN source_type VARCHAR(10) NOT NULL DEFAULT 'text',
    ADD COLUMN metadata    JSONB       NOT NULL DEFAULT '{}';

CREATE INDEX idx_kb_tenant_source_type
    ON knowledge_articles(tenant_id, source_type);

CREATE TABLE voice_recordings (
    id                       UUID PRIMARY KEY,
    tenant_id                UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    source_app_id            UUID NOT NULL REFERENCES apps(id) ON DELETE CASCADE,
    external_id              VARCHAR(128) NOT NULL,
    audio_url                TEXT,
    audio_auth_headers       JSONB,
    mime_type                VARCHAR(50),
    duration_seconds         INTEGER,
    language                 VARCHAR(10),
    caller                   VARCHAR(255),
    callee                   VARCHAR(255),
    direction                VARCHAR(10),
    customer_id              UUID REFERENCES customers(id) ON DELETE SET NULL,
    transcription_status     VARCHAR(20) NOT NULL DEFAULT 'pending',
    transcription_error      TEXT,
    transcription_attempts   INTEGER NOT NULL DEFAULT 0,
    article_id               UUID REFERENCES knowledge_articles(id) ON DELETE SET NULL,
    metadata                 JSONB NOT NULL DEFAULT '{}',
    recorded_at              TIMESTAMPTZ,
    transcribed_at           TIMESTAMPTZ,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_voice_recordings_dedup
    ON voice_recordings(tenant_id, source_app_id, external_id);

CREATE INDEX idx_voice_recordings_pending
    ON voice_recordings(tenant_id, transcription_status)
    WHERE transcription_status IN ('pending', 'failed');

CREATE INDEX idx_voice_recordings_customer
    ON voice_recordings(tenant_id, customer_id);
