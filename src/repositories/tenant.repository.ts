import { getPool } from '../database/pool';

export async function findTenantById(id: number) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM tenants WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function findTenantBySlug(slug: string) {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM tenants WHERE slug = $1', [slug]);
  return result.rows[0] || null;
}

export async function findTenantByApiKey(apiKey: string) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM tenants WHERE api_key = $1 AND is_active = true',
    [apiKey],
  );
  return result.rows[0] || null;
}

export async function findAllActiveTenants() {
  const pool = getPool();
  const result = await pool.query('SELECT * FROM tenants WHERE is_active = true');
  return result.rows;
}

export async function createTenant(data: {
  name: string;
  slug: string;
  apiKey: string;
  settings?: Record<string, unknown>;
}) {
  const pool = getPool();
  const result = await pool.query(
    `INSERT INTO tenants (name, slug, api_key, settings)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.name, data.slug, data.apiKey, data.settings ? JSON.stringify(data.settings) : null],
  );
  return result.rows[0];
}

export async function updateTenant(
  id: number,
  data: {
    name?: string;
    settings?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    setClauses.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }

  if (data.settings !== undefined) {
    setClauses.push(`settings = $${paramIndex++}`);
    values.push(JSON.stringify(data.settings));
  }

  if (data.isActive !== undefined) {
    setClauses.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }

  if (setClauses.length === 0) {
    return findTenantById(id);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(id);

  const result = await pool.query(
    `UPDATE tenants SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}
