import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createUser, createTenantUser } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

describe('Feature: Tenants', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('POST /my/tenants', () => {
    it('should create a tenant and make user the owner', async () => {
      const user = await createUser({ email: 'owner@test.com', password: 'password123' });

      const loginRes = await request
        .post('/auth/login')
        .send({ email: 'owner@test.com', password: 'password123' });
      const token = loginRes.body.access_token;

      const res = await request
        .post('/my/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme Inc', slug: 'acme' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Acme Inc');
      expect(res.body.slug).toBe('acme');
      expect(res.body.api_key).toBeDefined();
      expect(res.body.api_key.length).toBeGreaterThan(20);
      expect(res.body.is_active).toBe(true);
      expect(res.body.tenant_user.role).toBe('owner');
    });

    it('should return 401 without auth', async () => {
      const res = await request
        .post('/my/tenants')
        .send({ name: 'Acme Inc', slug: 'acme' });

      expect(res.status).toBe(401);
    });

    it('should return 400 when name or slug is missing', async () => {
      const user = await createUser({ email: 'owner2@test.com', password: 'password123' });

      const loginRes = await request
        .post('/auth/login')
        .send({ email: 'owner2@test.com', password: 'password123' });
      const token = loginRes.body.access_token;

      const res = await request
        .post('/my/tenants')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Acme Inc' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /tenants/:id', () => {
    it('should get tenant details as owner', async () => {
      const tenant = await createTenant({ name: 'My Tenant', slug: 'my-tenant' });
      const user = await createUser({ email: 'owner3@test.com', password: 'password123' });
      await createTenantUser(tenant.id, user.id, { role: 'owner' });

      const loginRes = await request
        .post('/auth/login')
        .send({ email: 'owner3@test.com', password: 'password123' });
      const token = loginRes.body.access_token;

      const res = await request
        .get(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(tenant.id);
      expect(res.body.name).toBe('My Tenant');
      expect(res.body.slug).toBe('my-tenant');
    });

    it('should return 404 for non-existent tenant', async () => {
      const tenant = await createTenant();
      const user = await createUser({ email: 'owner4@test.com', password: 'password123' });
      await createTenantUser(tenant.id, user.id, { role: 'owner' });

      const loginRes = await request
        .post('/auth/login')
        .send({ email: 'owner4@test.com', password: 'password123' });
      const token = loginRes.body.access_token;

      const res = await request
        .get('/tenants/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });

    it('should return 401 without auth', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}`);

      expect(res.status).toBe(401);
    });

    it('should return 403 for member role', async () => {
      const tenant = await createTenant();
      const user = await createUser({ email: 'member@test.com', password: 'password123' });
      await createTenantUser(tenant.id, user.id, { role: 'member' });

      const loginRes = await request
        .post('/auth/login')
        .send({ email: 'member@test.com', password: 'password123' });
      const token = loginRes.body.access_token;

      const res = await request
        .get(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PATCH /tenants/:id', () => {
    it('should update tenant settings as owner', async () => {
      const tenant = await createTenant({ name: 'Acme', slug: 'acme' });
      const user = await createUser({ email: 'owner5@test.com', password: 'password123' });
      await createTenantUser(tenant.id, user.id, { role: 'owner' });

      const loginRes = await request
        .post('/auth/login')
        .send({ email: 'owner5@test.com', password: 'password123' });
      const token = loginRes.body.access_token;

      const res = await request
        .patch(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settings: { auto_send_drafts: true, ai_model: 'gpt-4' } });

      expect(res.status).toBe(200);
      expect(res.body.settings.auto_send_drafts).toBe(true);
      expect(res.body.settings.ai_model).toBe('gpt-4');
    });
  });
});
