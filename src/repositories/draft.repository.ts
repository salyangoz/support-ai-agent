import { getPool } from '../database/pool';

export async function findDraftsByTicketId(tenantId: number, ticketId: number) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT * FROM drafts
     WHERE tenant_id = $1 AND ticket_id = $2
     ORDER BY created_at DESC`,
    [tenantId, ticketId],
  );
  return result.rows;
}

export async function findDraftById(tenantId: number, id: number) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM drafts WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return result.rows[0] || null;
}

export async function createDraft(data: {
  ticketId: number;
  tenantId: number;
  promptContext?: string;
  draftResponse: string;
  aiModel?: string;
  aiTokensUsed?: number;
}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO drafts (ticket_id, tenant_id, prompt_context, draft_response, ai_model, ai_tokens_used)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.ticketId,
      data.tenantId,
      data.promptContext || null,
      data.draftResponse,
      data.aiModel || null,
      data.aiTokensUsed || null,
    ],
  );
  return result.rows[0];
}

export async function updateDraftStatus(
  tenantId: number,
  id: number,
  status: string,
  reviewedBy?: string,
) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE drafts SET status = $1, reviewed_by = $2, reviewed_at = NOW(), updated_at = NOW()
     WHERE tenant_id = $3 AND id = $4
     RETURNING *`,
    [status, reviewedBy || null, tenantId, id],
  );
  return result.rows[0] || null;
}
