import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/index';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createCustomer } from '../helpers/fixtures';

const app = createApp();
const request = supertest(app);

describe('Feature: Customers', () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('POST /api/v1/tenants/:tenantId/customers', () => {
    it('should create a customer and return 201', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/api/v1/tenants/${tenant.id}/customers`)
        .set('X-API-Key', tenant.api_key)
        .send({
          email: 'john@example.com',
          name: 'John Doe',
          phone: '+1234567890',
          external_id: 'ext-john',
          metadata: { plan: 'premium' },
        });

      expect(res.status).toBe(201);
      expect(res.body.email).toBe('john@example.com');
      expect(res.body.name).toBe('John Doe');
      expect(res.body.tenant_id).toBe(tenant.id);
    });

    it('should upsert when same email is sent again', async () => {
      const tenant = await createTenant();

      const first = await request
        .post(`/api/v1/tenants/${tenant.id}/customers`)
        .set('X-API-Key', tenant.api_key)
        .send({ email: 'jane@example.com', name: 'Jane V1' });

      expect(first.status).toBe(201);

      const second = await request
        .post(`/api/v1/tenants/${tenant.id}/customers`)
        .set('X-API-Key', tenant.api_key)
        .send({ email: 'jane@example.com', name: 'Jane V2' });

      expect(second.status).toBe(201);
      expect(second.body.id).toBe(first.body.id);
      expect(second.body.name).toBe('Jane V2');
    });

    it('should return 400 without email', async () => {
      const tenant = await createTenant();

      const res = await request
        .post(`/api/v1/tenants/${tenant.id}/customers`)
        .set('X-API-Key', tenant.api_key)
        .send({ name: 'No Email' });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/tenants/:tenantId/customers', () => {
    it('should list customers for the tenant', async () => {
      const tenant = await createTenant();
      await createCustomer(tenant.id, { email: 'a@test.com', name: 'Alice' });
      await createCustomer(tenant.id, { email: 'b@test.com', name: 'Bob' });

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/customers`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /api/v1/tenants/:tenantId/customers/:id', () => {
    it('should return a single customer', async () => {
      const tenant = await createTenant();
      const customer = await createCustomer(tenant.id, { email: 'show@test.com' });

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/customers/${customer.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('show@test.com');
    });

    it('should return 404 for non-existent customer', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/customers/99999`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(404);
    });
  });

  describe('PUT /api/v1/tenants/:tenantId/customers/:id/metadata', () => {
    it('should update customer metadata', async () => {
      const tenant = await createTenant();
      const customer = await createCustomer(tenant.id);

      const res = await request
        .put(`/api/v1/tenants/${tenant.id}/customers/${customer.id}/metadata`)
        .set('X-API-Key', tenant.api_key)
        .send({ metadata: { tier: 'gold', region: 'eu' } });

      expect(res.status).toBe(200);
      expect(res.body.metadata.tier).toBe('gold');
      expect(res.body.metadata.region).toBe('eu');
    });

    it('should return 400 without metadata field', async () => {
      const tenant = await createTenant();
      const customer = await createCustomer(tenant.id);

      const res = await request
        .put(`/api/v1/tenants/${tenant.id}/customers/${customer.id}/metadata`)
        .set('X-API-Key', tenant.api_key)
        .send({});

      expect(res.status).toBe(400);
    });
  });
});
