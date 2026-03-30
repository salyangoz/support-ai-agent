import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/index';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createTicket, createDraft } from '../helpers/fixtures';

const app = createApp();
const request = supertest(app);

describe('Feature: Drafts', () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('GET /api/v1/tenants/:tenantId/tickets/:id/drafts', () => {
    it('should return empty list initially', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/tickets/${ticket.id}/drafts`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });

    it('should return drafts after fixture insert', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      await createDraft(ticket.id, tenant.id, { draft_response: 'Draft 1' });
      await createDraft(ticket.id, tenant.id, { draft_response: 'Draft 2' });

      const res = await request
        .get(`/api/v1/tenants/${tenant.id}/tickets/${ticket.id}/drafts`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
    });
  });

  describe('PATCH /api/v1/tenants/:tenantId/drafts/:id', () => {
    it('should update status to approved', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      const draft = await createDraft(ticket.id, tenant.id);

      const res = await request
        .patch(`/api/v1/tenants/${tenant.id}/drafts/${draft.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({ status: 'approved', reviewed_by: 'admin@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
    });

    it('should update status to rejected', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      const draft = await createDraft(ticket.id, tenant.id);

      const res = await request
        .patch(`/api/v1/tenants/${tenant.id}/drafts/${draft.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({ status: 'rejected' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('rejected');
    });

    it('should reject invalid status', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      const draft = await createDraft(ticket.id, tenant.id);

      const res = await request
        .patch(`/api/v1/tenants/${tenant.id}/drafts/${draft.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
    });

    it('should reject missing status', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      const draft = await createDraft(ticket.id, tenant.id);

      const res = await request
        .patch(`/api/v1/tenants/${tenant.id}/drafts/${draft.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent draft', async () => {
      const tenant = await createTenant();

      const res = await request
        .patch(`/api/v1/tenants/${tenant.id}/drafts/99999`)
        .set('X-API-Key', tenant.api_key)
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
    });
  });
});
