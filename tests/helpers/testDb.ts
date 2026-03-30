import { PrismaClient } from '../../src/generated/prisma/client';

let testPrisma: PrismaClient | null = null;

export function getTestPrisma(): PrismaClient {
  if (!testPrisma) {
    testPrisma = new PrismaClient();
  }
  return testPrisma;
}

export async function setupTestDb(): Promise<void> {
  getTestPrisma();
}

export async function truncateAll(): Promise<void> {
  const prisma = getTestPrisma();
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE drafts, messages, tickets, knowledge_articles,
    customers, tenant_providers, tenants CASCADE
  `);
}

export async function teardownTestDb(): Promise<void> {
  if (testPrisma) {
    await testPrisma.$disconnect();
    testPrisma = null;
  }
}
