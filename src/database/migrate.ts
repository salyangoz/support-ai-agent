import fs from 'fs';
import path from 'path';
import { getPool, closePool } from './pool';
import { logger } from '../utils/logger';

export async function runMigrations(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, 'migrations');
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
    logger.info(`Running migration: ${file}`);

    await pool.query('BEGIN');
    try {
      await pool.query(sql);
      await pool.query('INSERT INTO migrations (name) VALUES ($1)', [file]);
      await pool.query('COMMIT');
      logger.info(`Migration completed: ${file}`);
    } catch (err) {
      await pool.query('ROLLBACK');
      logger.error(`Migration failed: ${file}`, err);
      throw err;
    }
  }
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      logger.info('All migrations completed');
      return closePool();
    })
    .catch((err) => {
      logger.error('Migration failed', err);
      process.exit(1);
    });
}
