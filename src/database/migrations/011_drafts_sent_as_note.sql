ALTER TABLE drafts
    ADD COLUMN IF NOT EXISTS sent_as_note BOOLEAN NOT NULL DEFAULT FALSE;

-- Any existing row with external_message_id set was (by current code) sent
-- as a note — safe backfill so the redact query keeps finding them.
UPDATE drafts
SET sent_as_note = TRUE
WHERE external_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_drafts_note_redact
    ON drafts(tenant_id, ticket_id, external_app_id)
    WHERE sent_as_note = TRUE AND external_message_id IS NOT NULL;
