import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import supertest from 'supertest';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

// Mock the yengec-ai SDK
vi.mock('../../src/lib/yengec-ai', () => ({
  chat: vi.fn().mockResolvedValue({
    text: 'Based on our knowledge base, you can reset your password by visiting the settings page.',
    tokensUsed: 150,
  }),
  embed: vi.fn().mockResolvedValue(new Array(1536).fill(0.1)),
}));

describe('POST /tenants/:tenantId/chat', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  it('should return an AI answer with sources', async () => {
    const tenant = await createTenant();

    const res = await request
      .post(`/tenants/${tenant.id}/chat`)
      .set('X-API-Key', tenant.api_key)
      .send({ question: 'How do I reset my password?' });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
    expect(res.body.answer.length).toBeGreaterThan(0);
    expect(res.body.sources).toBeDefined();
    expect(Array.isArray(res.body.sources)).toBe(true);
    expect(res.body.tokens_used).toBeDefined();
  });

  it('should accept conversation history', async () => {
    const tenant = await createTenant();

    const res = await request
      .post(`/tenants/${tenant.id}/chat`)
      .set('X-API-Key', tenant.api_key)
      .send({
        question: 'Can you explain more?',
        history: [
          { role: 'user', content: 'How do I reset my password?' },
          { role: 'assistant', content: 'Go to settings and click reset.' },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.answer).toBeDefined();
  });

  it('should return 400 when question is missing', async () => {
    const tenant = await createTenant();

    const res = await request
      .post(`/tenants/${tenant.id}/chat`)
      .set('X-API-Key', tenant.api_key)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/question/i);
  });

  it('should return 401 without auth', async () => {
    const tenant = await createTenant();

    const res = await request
      .post(`/tenants/${tenant.id}/chat`)
      .send({ question: 'test' });

    expect(res.status).toBe(401);
  });
});
