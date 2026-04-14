import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createApp } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

describe('Feature: Apps', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('GET /tenants/:tenantId/apps', () => {
    it('should return empty list initially', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}/apps`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('should return apps after creation', async () => {
      const tenant = await createTenant();
      await createApp(tenant.id);

      const res = await request
        .get(`/tenants/${tenant.id}/apps`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].code).toBe('intercom');
      expect(res.body[0].type).toBe('ticket');
      expect(res.body[0].role).toBe('both');
    });
  });

  describe('POST /tenants/:tenantId/apps', () => {
    it('should add an app and return 201', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/tenants/${tenant.id}/apps`)
        .set('X-API-Key', tenant.api_key)
        .send({
          code: 'intercom',
          type: 'ticket',
          role: 'both',
          credentials: { accessToken: 'tok-123', clientSecret: 'sec-456' },
          webhook_secret: 'wh-secret',
        });

      expect(res.status).toBe(201);
      expect(res.body.code).toBe('intercom');
      expect(res.body.type).toBe('ticket');
      expect(res.body.role).toBe('both');
      expect(res.body.tenant_id).toBe(tenant.id);
      expect(res.body.is_active).toBe(true);
    });

    it('should return 400 without required fields', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/tenants/${tenant.id}/apps`)
        .set('X-API-Key', tenant.api_key)
        .send({ credentials: { accessToken: 'tok' } });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /tenants/:tenantId/apps/:appId', () => {
    it('should update credentials', async () => {
      const tenant = await createTenant();
      const appRecord = await createApp(tenant.id);

      const res = await request
        .put(`/tenants/${tenant.id}/apps/${appRecord.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({
          credentials: { accessToken: 'new-token', clientSecret: 'new-secret' },
        });

      expect(res.status).toBe(200);
      expect(res.body.credentials.access_token).toBe('new-token');
    });

    it('should return 404 for non-existent app', async () => {
      const tenant = await createTenant();

      const res = await request
        .put(`/tenants/${tenant.id}/apps/00000000-0000-0000-0000-000000000000`)
        .set('X-API-Key', tenant.api_key)
        .send({ credentials: { token: 'abc' } });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /tenants/:tenantId/apps/:appId', () => {
    it('should remove app and return 204', async () => {
      const tenant = await createTenant();
      const appRecord = await createApp(tenant.id);

      const res = await request
        .delete(`/tenants/${tenant.id}/apps/${appRecord.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(204);

      const listRes = await request
        .get(`/tenants/${tenant.id}/apps`)
        .set('X-API-Key', tenant.api_key);

      expect(listRes.body).toHaveLength(0);
    });
  });

  describe('Cross-tenant protection', () => {
    it('should return 403 when tenant A tries to access tenant B apps', async () => {
      const tenantA = await createTenant({ name: 'Tenant A', slug: 'tenant-a' });
      const tenantB = await createTenant({ name: 'Tenant B', slug: 'tenant-b' });
      await createApp(tenantB.id);

      const res = await request
        .get(`/tenants/${tenantB.id}/apps`)
        .set('X-API-Key', tenantA.api_key);

      expect(res.status).toBe(403);
    });
  });
});
