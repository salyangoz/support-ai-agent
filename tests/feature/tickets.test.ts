import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createTicket, createMessage, createCustomer } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

describe('Feature: Tickets', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('GET /tenants/:tenantId/tickets', () => {
    it('should return empty list initially', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}/tickets`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return tickets after fixture insert', async () => {
      const tenant = await createTenant();
      const customer = await createCustomer(tenant.id);
      await createTicket(tenant.id, { customer_id: customer.id, subject: 'Help me' });
      await createTicket(tenant.id, { customer_id: customer.id, subject: 'Another issue' });

      const res = await request
        .get(`/tenants/${tenant.id}/tickets`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
    });

    it('should filter tickets by state', async () => {
      const tenant = await createTenant();
      await createTicket(tenant.id, { state: 'open' });
      await createTicket(tenant.id, { state: 'closed' });

      const res = await request
        .get(`/tenants/${tenant.id}/tickets?state=open`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].state).toBe('open');
    });
  });

  describe('GET /tenants/:tenantId/tickets/:id', () => {
    it('should return ticket with messages', async () => {
      const tenant = await createTenant();
      const ticket = await createTicket(tenant.id, { subject: 'My Issue' });
      await createMessage(ticket.id, tenant.id, { body: 'Hello, I need help', author_role: 'customer' });
      await createMessage(ticket.id, tenant.id, { body: 'Sure, let me check', author_role: 'agent' });

      const res = await request
        .get(`/tenants/${tenant.id}/tickets/${ticket.id}`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(200);
      expect(res.body.ticket.subject).toBe('My Issue');
      expect(res.body.messages).toHaveLength(2);
    });

    it('should return 404 for non-existent ticket', async () => {
      const tenant = await createTenant();

      const res = await request
        .get(`/tenants/${tenant.id}/tickets/00000000-0000-0000-0000-000000000000`)
        .set('X-API-Key', tenant.api_key);

      expect(res.status).toBe(404);
    });
  });

  describe('Tenant isolation', () => {
    it('should not show tenant A tickets to tenant B', async () => {
      const tenantA = await createTenant({ name: 'A', slug: 'a' });
      const tenantB = await createTenant({ name: 'B', slug: 'b' });
      await createTicket(tenantA.id, { subject: 'Secret ticket' });

      const res = await request
        .get(`/tenants/${tenantB.id}/tickets`)
        .set('X-API-Key', tenantB.api_key);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(0);
    });

    it('should return 403 when tenant A uses tenant B endpoint', async () => {
      const tenantA = await createTenant({ name: 'A', slug: 'ta' });
      const tenantB = await createTenant({ name: 'B', slug: 'tb' });

      const res = await request
        .get(`/tenants/${tenantB.id}/tickets`)
        .set('X-API-Key', tenantA.api_key);

      expect(res.status).toBe(403);
    });
  });
});
