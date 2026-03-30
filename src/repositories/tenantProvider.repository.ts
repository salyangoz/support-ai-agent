import { getPool } from '../database/pool';

export async function findProvidersByTenantId(tenantId: number) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM tenant_providers WHERE tenant_id = $1',
    [tenantId],
  );
  return result.rows;
}

export async function findProvider(tenantId: number, provider: string) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM tenant_providers WHERE tenant_id = $1 AND provider = $2',
    [tenantId, provider],
  );
  return result.rows[0] || null;
}

export async function createProvider(data: {
  tenantId: number;
  provider: string;
  credentials: Record<string, unknown>;
  webhookSecret?: string;
}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tenant_providers (tenant_id, provider, credentials, webhook_secret)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.tenantId, data.provider, JSON.stringify(data.credentials), data.webhookSecret || null],
  );
  return result.rows[0];
}

export async function updateProvider(
  tenantId: number,
  provider: string,
  data: {
    credentials?: Record<string, unknown>;
    webhookSecret?: string;
    isActive?: boolean;
  },
) {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.credentials !== undefined) {
    setClauses.push(`credentials = $${paramIndex++}`);
    values.push(JSON.stringify(data.credentials));
  }

  if (data.webhookSecret !== undefined) {
    setClauses.push(`webhook_secret = $${paramIndex++}`);
    values.push(data.webhookSecret);
  }

  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }

  if (setClauses.length === 0) {
    return findProvider(tenantId, provider);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(tenantId);
  values.push(provider);

  const result = await pool.query(
    `UPDATE tenant_providers SET ${setClauses.join(', ')}
     WHERE tenant_id = $${paramIndex++} AND provider = $${paramIndex}
     RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function deleteProvider(tenantId: number, provider: string) {
  const pool = getPool();
  await pool.query(
    'DELETE FROM tenant_providers WHERE tenant_id = $1 AND provider = $2',
    [tenantId, provider],
  );
}
