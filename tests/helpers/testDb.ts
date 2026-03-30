import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

let testPool: Pool | null = null;

export function getTestPool(): Pool {
  if (!testPool) {
    testPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
    });
  }
  return testPool;
}

export async function setupTestDb(): Promise<void> {
  const pool = getTestPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '../../src/database/migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const { rows: executed } = await pool.query('SELECT name FROM migrations');
  const executedNames = new Set(executed.map(r => r.name));

  for (const file of files) {
    if (executedNames.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
    } catch (err) {
      await pool.query('ROLLBACK');
      throw err;
    }
  }
}

export async function truncateAll(): Promise<void> {
  const pool = getTestPool();
  await pool.query(`
    TRUNCATE TABLE drafts, messages, tickets, knowledge_articles,
    customers, tenant_providers, tenants CASCADE
  `);
}

export async function teardownTestDb(): Promise<void> {
  if (testPool) {
    await testPool.end();
    testPool = null;
  }
}
