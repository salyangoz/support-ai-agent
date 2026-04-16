import { PrismaClient } from '../../src/generated/prisma/client';

let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    throw new Error('Test DB not initialized. Call setupTestDb() first.');
  }
  return testPrisma;
}

export async function setupTestDb(): Promise<void> {
  if (!testPrisma) {
    const { getPrisma } = await import('../../src/database/prisma');
    testPrisma = getPrisma();
  }
}

export async function truncateAll(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE drafts, messages, tickets, knowledge_chunks, knowledge_articles,
    customers, apps, tenant_users, users, tenants CASCADE
  `);
}

export async function teardownTestDb(): Promise<void> {
  testPrisma = null;
}
