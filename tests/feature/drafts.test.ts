import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createTicket, createDraft } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

describe('Feature: Drafts', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('GET /tenants/:tenantId/tickets/:id/drafts', () => {
    it('should return empty list initially', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);

      const res = await request
        .get(`/tenants/${tenant.id}/tickets/${ticket.id}/drafts`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return drafts after fixture insert', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      await createDraft(ticket.id, tenant.id, { draft_response: 'Draft 1' });
      await createDraft(ticket.id, tenant.id, { draft_response: 'Draft 2' });

      const res = await request
        .get(`/tenants/${tenant.id}/tickets/${ticket.id}/drafts`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });
  });

  describe('GET /tenants/:tenantId/drafts', () => {
    it('should return empty list initially', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}/drafts`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return all drafts across tickets', async () => {
      const tenant = await createTenant();
      const ticket1 = await createTicket(tenant.id);
      const ticket2 = await createTicket(tenant.id);
      await createDraft(ticket1.id, tenant.id, { draft_response: 'D1' });
      await createDraft(ticket2.id, tenant.id, { draft_response: 'D2' });

      const res = await request
        .get(`/tenants/${tenant.id}/drafts`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter by status', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      await createDraft(ticket.id, tenant.id, { status: 'pending' });
      await createDraft(ticket.id, tenant.id, { status: 'approved' });

      const res = await request
        .get(`/tenants/${tenant.id}/drafts?status=pending`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('pending');
    });

    it('should return pagination metadata and support cursor', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      await createDraft(ticket.id, tenant.id, { draft_response: 'D1' });
      await createDraft(ticket.id, tenant.id, { draft_response: 'D2' });
      await createDraft(ticket.id, tenant.id, { draft_response: 'D3' });

      const page1 = await request
        .get(`/tenants/${tenant.id}/drafts?limit=2`)
        .set('X-API-Key', tenant.api_key);

      expect(page1.status).toBe(200);
      expect(page1.body.data).toHaveLength(2);
      expect(page1.body.pagination.has_more).toBe(true);
      expect(page1.body.pagination.total).toBe(3);
      expect(page1.body.pagination.next_cursor).toBeDefined();

      const page2 = await request
        .get(`/tenants/${tenant.id}/drafts?limit=2&cursor=${page1.body.pagination.next_cursor}`)
        .set('X-API-Key', tenant.api_key);

      expect(page2.body.data).toHaveLength(1);
      expect(page2.body.pagination.has_more).toBe(false);
      expect(page2.body.pagination.total).toBe(3);
    });

    it('should return correct total with status filter', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      await createDraft(ticket.id, tenant.id, { status: 'pending' });
      await createDraft(ticket.id, tenant.id, { status: 'pending' });
      await createDraft(ticket.id, tenant.id, { status: 'approved' });

      const res = await request
        .get(`/tenants/${tenant.id}/drafts?status=pending`)
        .set('X-API-Key', tenant.api_key);

      expect(res.body.pagination.total).toBe(2);
    });
  });

  describe('PATCH /tenants/:tenantId/drafts/:id', () => {
    it('should update status to approved', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      const draft = await createDraft(ticket.id, tenant.id);

      const res = await request
        .patch(`/tenants/${tenant.id}/drafts/${draft.id}`)
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
        .patch(`/tenants/${tenant.id}/drafts/${draft.id}`)
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
        .patch(`/tenants/${tenant.id}/drafts/${draft.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({ status: 'invalid-status' });

      expect(res.status).toBe(400);
    });

    it('should reject missing status', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id);
      const draft = await createDraft(ticket.id, tenant.id);

      const res = await request
        .patch(`/tenants/${tenant.id}/drafts/${draft.id}`)
        .set('X-API-Key', tenant.api_key)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent draft', async () => {
      const tenant = await createTenant();

      const res = await request
        .patch(`/tenants/${tenant.id}/drafts/00000000-0000-0000-0000-000000000000`)
        .set('X-API-Key', tenant.api_key)
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
    });
  });
});
