ALTER TABLE tickets ADD COLUMN last_message_at TIMESTAMPTZ;
ALTER TABLE tickets ADD COLUMN last_message_by VARCHAR(255);
ALTER TABLE tickets ADD COLUMN last_message_role VARCHAR(20);
