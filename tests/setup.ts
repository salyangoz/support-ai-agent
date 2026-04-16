import dotenv from 'dotenv';
dotenv.config({ path: '.env.test' });

import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Idempotent: only start PGlite once per process
const g = globalThis as any;

if (!g.__pgliteStarted) {
  g.__pgliteStarted = true;

  const pglite = new PGlite({ extensions: { vector } });
  await pglite.waitReady;

  const socketServer = new PGLiteSocketServer({ db: pglite, port: 0 });
  await socketServer.start();
  const port = socketServer.port;

  const url = `postgresql://postgres@localhost:${port}/postgres`;
  process.env.DATABASE_URL = url;

  // Run migrations
  const migrationsDir = path.join(__dirname, '../src/database/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  const pool = new Pool({ connectionString: url, max: 5 });
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
  }
  await pool.end();

  // Store references for cleanup
  g.__pglite = pglite;
  g.__pgliteSocket = socketServer;
}
