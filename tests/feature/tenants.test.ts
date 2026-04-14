import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;
const ADMIN_KEY = 'test-admin-key';

describe('Feature: Tenants', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('POST /tenants', () => {
    it('should create a tenant with admin key and return api_key', async () => {
      const res = await request
        .post('/tenants')
        .set('X-API-Key', ADMIN_KEY)
        .send({ name: 'Acme Inc', slug: 'acme' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Acme Inc');
      expect(res.body.slug).toBe('acme');
      expect(res.body.api_key).toBeDefined();
      expect(res.body.api_key.length).toBeGreaterThan(20);
      expect(res.body.is_active).toBe(true);
    });

    it('should return 401 without admin key', async () => {
      const res = await request
        .post('/tenants')
        .send({ name: 'Acme Inc', slug: 'acme' });

      expect(res.status).toBe(401);
    });

    it('should return 401 with wrong admin key', async () => {
      const res = await request
        .post('/tenants')
        .set('X-API-Key', 'wrong-key')
        .send({ name: 'Acme Inc', slug: 'acme' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when name or slug is missing', async () => {
      const res = await request
        .post('/tenants')
        .set('X-API-Key', ADMIN_KEY)
        .send({ name: 'Acme Inc' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /tenants/:id', () => {
    it('should get tenant details with admin key', async () => {
      const tenant = await createTenant({ name: 'My Tenant', slug: 'my-tenant' });

      const res = await request
        .get(`/tenants/${tenant.id}`)
        .set('X-API-Key', ADMIN_KEY);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(tenant.id);
      expect(res.body.name).toBe('My Tenant');
      expect(res.body.slug).toBe('my-tenant');
    });

    it('should return 404 for non-existent tenant', async () => {
      const res = await request
        .get('/tenants/00000000-0000-0000-0000-000000000000')
        .set('X-API-Key', ADMIN_KEY);

      expect(res.status).toBe(404);
    });

    it('should return 401 without admin key', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /tenants/:id', () => {
    it('should update tenant name', async () => {
      const tenant = await createTenant({ name: 'Old Name', slug: 'old-name' });

      const res = await request
        .put(`/tenants/${tenant.id}`)
        .set('X-API-Key', ADMIN_KEY)
        .send({ name: 'New Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('New Name');
    });

    it('should update tenant settings', async () => {
      const tenant = await createTenant({ name: 'Acme', slug: 'acme' });

      const res = await request
        .put(`/tenants/${tenant.id}`)
        .set('X-API-Key', ADMIN_KEY)
        .send({ settings: { auto_send_drafts: true, ai_model: 'gpt-4' } });

      expect(res.status).toBe(200);
      expect(res.body.settings.auto_send_drafts).toBe(true);
      expect(res.body.settings.ai_model).toBe('gpt-4');
    });

    it('should return 404 for non-existent tenant', async () => {
      const res = await request
        .put('/tenants/00000000-0000-0000-0000-000000000000')
        .set('X-API-Key', ADMIN_KEY)
        .send({ name: 'New Name' });

      expect(res.status).toBe(404);
    });
  });
});
