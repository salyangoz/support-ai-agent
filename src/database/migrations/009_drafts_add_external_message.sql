DROP TABLE IF EXISTS ticket_note_sends;

ALTER TABLE drafts
    ADD COLUMN IF NOT EXISTS external_app_id UUID REFERENCES apps(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_message_id VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_drafts_external
    ON drafts(tenant_id, ticket_id, external_app_id)
    WHERE external_message_id IS NOT NULL;
