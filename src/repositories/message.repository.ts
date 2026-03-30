import { getPool } from '../database/pool';

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function findMessagesByTicketId(ticketId: number, tenantId: number) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM messages
     WHERE ticket_id = $1 AND tenant_id = $2
     ORDER BY external_created_at ASC`,
    [ticketId, tenantId],
  );
  return result.rows;
}

export async function upsertMessage(data: {
  ticketId: number;
  tenantId: number;
  externalId: string;
  authorRole: string;
  authorId?: string;
  authorName?: string;
  body?: string;
  externalCreatedAt?: string;
}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO messages (
       ticket_id, tenant_id, external_id, author_role, author_id,
       author_name, body, external_created_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (ticket_id, external_id) DO UPDATE SET
       author_role = COALESCE(EXCLUDED.author_role, messages.author_role),
       author_id = COALESCE(EXCLUDED.author_id, messages.author_id),
       author_name = COALESCE(EXCLUDED.author_name, messages.author_name),
       body = COALESCE(EXCLUDED.body, messages.body),
       external_created_at = COALESCE(EXCLUDED.external_created_at, messages.external_created_at)
     RETURNING *`,
    [
      data.ticketId,
      data.tenantId,
      data.externalId,
      data.authorRole,
      data.authorId || null,
      data.authorName || null,
      data.body || null,
      data.externalCreatedAt || null,
    ],
  );
  return result.rows[0];
}

export async function updateMessageEmbedding(id: number, embedding: number[]) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE messages SET embedding = $1::vector WHERE id = $2 RETURNING *`,
    [formatEmbedding(embedding), id],
  );
  return result.rows[0] || null;
}

export async function findSimilarAgentMessages(
  tenantId: number,
  embedding: number[],
  excludeTicketId: number,
  limit: number,
) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT m.body, t.initial_body
     FROM messages m
     JOIN tickets t ON t.id = m.ticket_id
     WHERE m.tenant_id = $1
       AND m.author_role = 'agent'
       AND m.embedding IS NOT NULL
       AND m.ticket_id != $2
     ORDER BY m.embedding <=> $3::vector
     LIMIT $4`,
    [tenantId, excludeTicketId, formatEmbedding(embedding), limit],
  );
  return result.rows;
}

export async function findMessagesWithoutEmbedding(tenantId: number) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM messages
     WHERE tenant_id = $1
       AND author_role = 'agent'
       AND embedding IS NULL`,
    [tenantId],
  );
  return result.rows;
}
