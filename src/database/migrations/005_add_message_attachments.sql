CREATE TABLE message_attachments (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  external_id VARCHAR(255),
  file_name VARCHAR(500) NOT NULL,
  file_type VARCHAR(100),
  file_size INTEGER,
  url TEXT NOT NULL,
  content_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_message_attachments_message_id ON message_attachments(message_id);
CREATE INDEX idx_message_attachments_tenant_id ON message_attachments(tenant_id);
