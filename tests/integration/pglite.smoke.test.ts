import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupPGliteDb, teardownPGliteDb, truncateAllPGlite, getPGlitePool } from '../helpers/pgliteDb';
import { PrismaClient } from '../../src/generated/prisma/client';
import { generateId } from '../../src/utils/uuid';

let prisma: PrismaClient;

describe('PGlite Smoke Test', () => {
  beforeAll(async () => {
    const db = await setupPGliteDb();
    prisma = db.prisma;
  }, 30000);

  afterAll(async () => {
    await teardownPGliteDb();
  });

  it('should create a tenant via Prisma', async () => {
    const tenant = await prisma.tenant.create({
      data: { id: generateId(), name: 'Acme', slug: 'acme', apiKey: 'key-1', settings: {} },
    });

    expect(tenant.id).toBeDefined();
    expect(tenant.name).toBe('Acme');
  });

  it('should create an app linked to tenant', async () => {
    const tenant = await prisma.tenant.findFirst();
    const app = await prisma.app.create({
      data: {
        id: generateId(),
        tenantId: tenant!.id,
        code: 'intercom',
        type: 'ticket',
        role: 'both',
        credentials: { accessToken: 'tok', clientSecret: 'sec' },
      },
    });

    expect(app.id).toBeDefined();
    expect(app.code).toBe('intercom');
    expect(app.role).toBe('both');
  });

  it('should create a ticket linked to app', async () => {
    const tenant = await prisma.tenant.findFirst();
    const app = await prisma.app.findFirst();
    const ticket = await prisma.ticket.create({
      data: {
        id: generateId(),
        tenantId: tenant!.id,
        inputAppId: app!.id,
        externalId: 'conv-1',
        state: 'open',
        subject: 'Test ticket',
      },
    });

    expect(ticket.id).toBeDefined();
    expect(ticket.inputAppId).toBe(app!.id);
  });

  it('should support vector operations via raw SQL', async () => {
    const tenant = await prisma.tenant.findFirst();
    const article = await prisma.knowledgeArticle.create({
      data: {
        id: generateId(),
        tenantId: tenant!.id,
        title: 'Shipping FAQ',
        content: 'Orders ship in 3-5 days',
      },
    });

    const pool = getPGlitePool();
    const vec1536 = '[' + Array(1536).fill(0).map((_, i) => (i * 0.001).toFixed(4)).join(',') + ']';
    await pool.query(
      'UPDATE knowledge_articles SET embedding = $1::vector WHERE id = $2',
      [vec1536, article.id],
    );

    const { rows } = await pool.query(
      'SELECT id, title FROM knowledge_articles WHERE embedding IS NOT NULL AND tenant_id = $1',
      [tenant!.id],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe('Shipping FAQ');
  });

  it('should truncate all tables', async () => {
    await truncateAllPGlite();

    const tenants = await prisma.tenant.findMany();
    expect(tenants).toHaveLength(0);
  });
});
