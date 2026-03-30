import { getPool } from '../database/pool';

export async function findCustomersByTenantId(
  tenantId: number,
  opts?: {
    email?: string;
    name?: string;
    page?: number;
    limit?: number;
  },
) {
  const pool = getPool();
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (opts?.email) {
    conditions.push(`email = $${paramIndex++}`);
    values.push(opts.email);
  }

  if (opts?.name) {
    conditions.push(`name ILIKE $${paramIndex++}`);
    values.push(`%${opts.name}%`);
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;
  const offset = (page - 1) * limit;

  values.push(limit);
  values.push(offset);

  const result = await pool.query(
    `SELECT * FROM customers
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values,
  );
  return result.rows;
}

export async function findCustomerById(tenantId: number, id: number) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return result.rows[0] || null;
}

export async function findCustomerByEmail(tenantId: number, email: string) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM customers WHERE tenant_id = $1 AND email = $2',
    [tenantId, email],
  );
  return result.rows[0] || null;
}

export async function upsertCustomer(data: {
  tenantId: number;
  email: string;
  name?: string;
  phone?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO customers (tenant_id, email, name, phone, external_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (tenant_id, email) DO UPDATE SET
       name = COALESCE(EXCLUDED.name, customers.name),
       phone = COALESCE(EXCLUDED.phone, customers.phone),
       external_id = COALESCE(EXCLUDED.external_id, customers.external_id),
       metadata = COALESCE(EXCLUDED.metadata, customers.metadata),
       updated_at = NOW()
     RETURNING *`,
    [
      data.tenantId,
      data.email,
      data.name || null,
      data.phone || null,
      data.externalId || null,
      data.metadata ? JSON.stringify(data.metadata) : null,
    ],
  );
  return result.rows[0];
}

export async function updateCustomerMetadata(
  tenantId: number,
  id: number,
  metadata: Record<string, unknown>,
) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE customers SET metadata = $1, updated_at = NOW()
     WHERE tenant_id = $2 AND id = $3
     RETURNING *`,
    [JSON.stringify(metadata), tenantId, id],
  );
  return result.rows[0] || null;
}
