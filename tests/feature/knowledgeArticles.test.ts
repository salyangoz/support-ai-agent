import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import supertest from 'supertest';

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createKnowledgeArticle } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

describe('Feature: Knowledge Articles', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('POST /tenants/:tenantId/knowledge-articles', () => {
    it('should create an article and return 201', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/tenants/${tenant.id}/knowledge-articles`)
        .set('X-API-Key', tenant.api_key)
        .send({
          title: 'Getting Started',
          content: 'Here is how to get started...',
          category: 'onboarding',
        });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('Getting Started');
      expect(res.body.category).toBe('onboarding');
      expect(res.body.tenant_id).toBe(tenant.id);
      expect(res.body.is_active).toBe(true);
    });

    it('should return 400 without title', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/tenants/${tenant.id}/knowledge-articles`)
        .set('X-API-Key', tenant.api_key)
        .send({ content: 'No title here' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /tenants/:tenantId/knowledge-articles', () => {
    it('should list articles for the tenant', async () => {
      const tenant = await createTenant();
      await createKnowledgeArticle(tenant.id, { title: 'Article 1' });
      await createKnowledgeArticle(tenant.id, { title: 'Article 2' });

      const res = await request
        .get(`/tenants/${tenant.id}/knowledge-articles`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /tenants/:tenantId/knowledge-articles/:id', () => {
    it('should return a single article', async () => {
      const tenant = await createTenant();
      const article = await createKnowledgeArticle(tenant.id, { title: 'FAQ' });

      const res = await request
        .get(`/tenants/${tenant.id}/knowledge-articles/${article.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('FAQ');
    });

    it('should return 404 for non-existent article', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}/knowledge-articles/00000000-0000-0000-0000-000000000000`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /tenants/:tenantId/knowledge-articles/:id', () => {
    it('should update an article', async () => {
      const tenant = await createTenant();
      const article = await createKnowledgeArticle(tenant.id, { title: 'Old Title' });

      const res = await request
        .put(`/tenants/${tenant.id}/knowledge-articles/${article.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({ title: 'New Title', content: 'Updated content' });

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('New Title');
      expect(res.body.content).toBe('Updated content');
    });
  });

  describe('DELETE /tenants/:tenantId/knowledge-articles/:id', () => {
    it('should soft delete an article and return 204', async () => {
      const tenant = await createTenant();
      const article = await createKnowledgeArticle(tenant.id);

      const res = await request
        .delete(`/tenants/${tenant.id}/knowledge-articles/${article.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(204);

      const showRes = await request
        .get(`/tenants/${tenant.id}/knowledge-articles/${article.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(showRes.body.is_active).toBe(false);
    });
  });

  describe('Tenant isolation', () => {
    it('should not show tenant A articles to tenant B', async () => {
      const tenantA = await createTenant({ name: 'A', slug: 'ka' });
      const tenantB = await createTenant({ name: 'B', slug: 'kb' });
      await createKnowledgeArticle(tenantA.id, { title: 'Private Article' });

      const res = await request
        .get(`/tenants/${tenantB.id}/knowledge-articles`)
        .set('X-API-Key', tenantB.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return 403 when using wrong tenant API key', async () => {
      const tenantA = await createTenant({ name: 'A', slug: 'ka2' });
      const tenantB = await createTenant({ name: 'B', slug: 'kb2' });

      const res = await request
        .get(`/tenants/${tenantB.id}/knowledge-articles`)
        .set('X-API-Key', tenantA.api_key);

      expect(res.status).toBe(403);
    });
  });

  describe('Embedding status', () => {
    it('should include embedding_status in article list', async () => {
      const tenant = await createTenant();
      await createKnowledgeArticle(tenant.id, { title: 'Test' });

      const res = await request
        .get(`/tenants/${tenant.id}/knowledge-articles`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data[0].embedding_status).toBeDefined();
      expect(res.body.data[0].embedding_status.total_chunks).toBeGreaterThanOrEqual(0);
      expect(res.body.data[0].embedding_status.embedded_chunks).toBe(0);
    });

    it('should include embedding_status in article show', async () => {
      const tenant = await createTenant();
      const article = await createKnowledgeArticle(tenant.id, { title: 'Test' });

      const res = await request
        .get(`/tenants/${tenant.id}/knowledge-articles/${article.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.embedding_status).toBeDefined();
      expect(res.body.embedding_status.total_chunks).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /tenants/:tenantId/knowledge-articles/:id/embed', () => {
    it('should return 404 for non-existent article', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/tenants/${tenant.id}/knowledge-articles/00000000-0000-0000-0000-000000000000/embed`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(404);
    });
  });

  describe('POST /tenants/:tenantId/knowledge-articles/embed', () => {
    it('should queue embedding jobs', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/tenants/${tenant.id}/knowledge-articles/embed`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(202);
      expect(res.body.enqueued).toBeDefined();
      expect(res.body.message).toBeDefined();
    });
  });
});
