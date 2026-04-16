-- Add external_id to knowledge_articles for synced sources (e.g., GitHub file paths)
ALTER TABLE knowledge_articles ADD COLUMN external_id VARCHAR(500);
CREATE UNIQUE INDEX idx_ka_tenant_external ON knowledge_articles(tenant_id, external_id);

-- Knowledge chunks table for chunked article content with per-chunk embeddings
CREATE TABLE knowledge_chunks (
    id          UUID PRIMARY KEY,
    article_id  UUID NOT NULL REFERENCES knowledge_articles(id) ON DELETE CASCADE,
    tenant_id   UUID NOT NULL REFERENCES tenants(id),
    chunk_index INTEGER NOT NULL,
    content     TEXT NOT NULL,
    embedding   vector(1536),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_chunks_article ON knowledge_chunks(article_id);
CREATE INDEX idx_chunks_tenant ON knowledge_chunks(tenant_id);
