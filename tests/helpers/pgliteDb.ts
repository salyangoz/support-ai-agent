import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite/vector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../src/generated/prisma/client';
import fs from 'fs';
import path from 'path';

let pglite: PGlite | null = null;
let socketServer: any = null;
let pool: Pool | null = null;
let prisma: PrismaClient | null = null;

/**
 * Creates an in-memory PostgreSQL via PGlite with pgvector support.
 * Exposes it as a TCP server so standard pg.Pool and Prisma can connect.
 * Runs all migration SQL files automatically.
 *
 * No Docker or external database needed.
 */
export async function setupPGliteDb(): Promise<{ prisma: PrismaClient; pool: Pool }> {
  pglite = new PGlite({ extensions: { vector } });
  await pglite.waitReady;

  // Start TCP server so pg.Pool can connect (port 0 = auto-assign)
  socketServer = new PGLiteSocketServer({ db: pglite, port: 0 });
  await socketServer.start();
  const port = socketServer.port;

  // Create a real pg.Pool connected to PGlite via TCP
  pool = new Pool({
    connectionString: `postgresql://postgres@localhost:${port}/postgres`,
    max: 5,
  });

  // Run all migration SQL files in order
  const migrationsDir = path.join(__dirname, '../../src/database/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);
  }

  // Create Prisma client connected to PGlite
  const adapter = new PrismaPg(pool);
  prisma = new PrismaClient({ adapter });

  return { prisma, pool };
}

/**
 * Truncate all tables for test isolation.
 */
export async function truncateAllPGlite(): Promise<void> {
  if (!pool) return;
  await pool.query(`
    TRUNCATE TABLE drafts, messages, tickets, knowledge_chunks, knowledge_articles,
    customers, apps, tenant_users, users, tenants CASCADE
  `);
}

/**
 * Tear down everything.
 */
export async function teardownPGliteDb(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
  if (socketServer) {
    await socketServer.stop();
    socketServer = null;
  }
  if (pglite) {
    await pglite.close();
    pglite = null;
  }
}

export function getPGlitePrisma(): PrismaClient {
  if (!prisma) throw new Error('PGlite not initialized. Call setupPGliteDb() first.');
  return prisma;
}

export function getPGlitePool(): Pool {
  if (!pool) throw new Error('PGlite not initialized. Call setupPGliteDb() first.');
  return pool;
}
