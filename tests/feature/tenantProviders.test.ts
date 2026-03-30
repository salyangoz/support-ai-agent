import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/index';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createTenantProvider } from '../helpers/fixtures';

const app = createApp();
const request = supertest(app);

describe('Feature: Tenant Providers', () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('GET /api/v1/tenants/:tenantId/providers', () => {
    it('should return empty list initially', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/providers`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return providers after creation', async () => {
      const tenant = await createTenant();
      await createTenantProvider(tenant.id);

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/providers`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].provider).toBe('intercom');
    });
  });

  describe('POST /api/v1/tenants/:tenantId/providers', () => {
    it('should add intercom config and return 201', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/api/v1/tenants/${tenant.id}/providers`)
        .set('X-API-Key', tenant.api_key)
        .send({
          provider: 'intercom',
          credentials: { accessToken: 'tok-123', clientSecret: 'sec-456' },
          webhook_secret: 'wh-secret',
        });

      expect(res.status).toBe(201);
      expect(res.body.provider).toBe('intercom');
      expect(res.body.tenant_id).toBe(tenant.id);
      expect(res.body.is_active).toBe(true);
    });

    it('should return 400 without provider field', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/api/v1/tenants/${tenant.id}/providers`)
        .set('X-API-Key', tenant.api_key)
        .send({ credentials: { accessToken: 'tok' } });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/providers/:provider', () => {
    it('should update credentials', async () => {
      const tenant = await createTenant();
      await createTenantProvider(tenant.id);

      const res = await request
        .put(`/api/v1/tenants/${tenant.id}/providers/intercom`)
        .set('X-API-Key', tenant.api_key)
        .send({
          credentials: { accessToken: 'new-token', clientSecret: 'new-secret' },
        });

      expect(res.status).toBe(200);
      expect(res.body.credentials.accessToken).toBe('new-token');
    });

    it('should return 404 for non-existent provider', async () => {
      const tenant = await createTenant();

      const res = await request
        .put(`/api/v1/tenants/${tenant.id}/providers/zendesk`)
        .set('X-API-Key', tenant.api_key)
        .send({ credentials: { token: 'abc' } });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/v1/tenants/:tenantId/providers/:provider', () => {
    it('should remove provider and return 204', async () => {
      const tenant = await createTenant();
      await createTenantProvider(tenant.id);

      const res = await request
        .delete(`/api/v1/tenants/${tenant.id}/providers/intercom`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(204);

      const listRes = await request
        .get(`/api/v1/tenants/${tenant.id}/providers`)
        .set('X-API-Key', tenant.api_key);

      expect(listRes.body).toHaveLength(0);
    });
  });

  describe('Cross-tenant protection', () => {
    it('should return 403 when tenant A tries to access tenant B providers', async () => {
      const tenantA = await createTenant({ name: 'Tenant A', slug: 'tenant-a' });
      const tenantB = await createTenant({ name: 'Tenant B', slug: 'tenant-b' });
      await createTenantProvider(tenantB.id);

      const res = await request
        .get(`/api/v1/tenants/${tenantB.id}/providers`)
        .set('X-API-Key', tenantA.api_key);

      expect(res.status).toBe(403);
    });
  });
});
