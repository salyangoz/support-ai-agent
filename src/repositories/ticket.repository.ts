import { getPool } from '../database/pool';

export async function findTicketsByTenantId(
  tenantId: number,
  opts?: {
    provider?: string;
    state?: string;
    customerId?: number;
    page?: number;
    limit?: number;
  },
) {
  const pool = getPool();
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (opts?.provider) {
    conditions.push(`provider = $${paramIndex++}`);
    values.push(opts.provider);
  }

  if (opts?.state) {
    conditions.push(`state = $${paramIndex++}`);
    values.push(opts.state);
  }

  if (opts?.customerId) {
    conditions.push(`customer_id = $${paramIndex++}`);
    values.push(opts.customerId);
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;
  const offset = (page - 1) * limit;

  values.push(limit);
  values.push(offset);

  const result = await pool.query(
    `SELECT * FROM tickets
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values,
  );
  return result.rows;
}

export async function findTicketById(tenantId: number, id: number) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT t.*, c.email AS customer_email, c.name AS customer_name
     FROM tickets t
     LEFT JOIN customers c ON c.id = t.customer_id
     WHERE t.tenant_id = $1 AND t.id = $2`,
    [tenantId, id],
  );
  return result.rows[0] || null;
}

export async function upsertTicket(data: {
  tenantId: number;
  provider: string;
  externalId: string;
  state?: string;
  subject?: string;
  initialBody?: string;
  language?: string;
  assigneeId?: string;
  customerId?: number;
  externalCreatedAt?: string;
  externalUpdatedAt?: string;
}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tickets (
       tenant_id, provider, external_id, state, subject, initial_body,
       language, assignee_id, customer_id, external_created_at, external_updated_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     ON CONFLICT (tenant_id, provider, external_id) DO UPDATE SET
       state = COALESCE(EXCLUDED.state, tickets.state),
       subject = COALESCE(EXCLUDED.subject, tickets.subject),
       initial_body = COALESCE(EXCLUDED.initial_body, tickets.initial_body),
       language = COALESCE(EXCLUDED.language, tickets.language),
       assignee_id = COALESCE(EXCLUDED.assignee_id, tickets.assignee_id),
       customer_id = COALESCE(EXCLUDED.customer_id, tickets.customer_id),
       external_updated_at = COALESCE(EXCLUDED.external_updated_at, tickets.external_updated_at),
       updated_at = NOW()
     RETURNING *`,
    [
      data.tenantId,
      data.provider,
      data.externalId,
      data.state || null,
      data.subject || null,
      data.initialBody || null,
      data.language || null,
      data.assigneeId || null,
      data.customerId || null,
      data.externalCreatedAt || null,
      data.externalUpdatedAt || null,
    ],
  );
  return result.rows[0];
}

export async function updateTicketState(tenantId: number, id: number, state: string) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE tickets SET state = $1, updated_at = NOW()
     WHERE tenant_id = $2 AND id = $3
     RETURNING *`,
    [state, tenantId, id],
  );
  return result.rows[0] || null;
}

export async function updateTicketAssignee(tenantId: number, id: number, assigneeId: string) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE tickets SET assignee_id = $1, updated_at = NOW()
     WHERE tenant_id = $2 AND id = $3
     RETURNING *`,
    [assigneeId, tenantId, id],
  );
  return result.rows[0] || null;
}
