import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/index';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import {
  createTenant,
  createCustomer,
  createTicket,
  createMessage,
  createKnowledgeArticle,
  createDraft,
  createTenantProvider,
} from '../helpers/fixtures';

const app = createApp();
const request = supertest(app);

describe('Feature: Tenant Isolation', () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  let tenantA: any;
  let tenantB: any;

  beforeEach(async () => {
    tenantA = await createTenant({ name: 'Tenant A', slug: 'iso-a' });
    tenantB = await createTenant({ name: 'Tenant B', slug: 'iso-b' });

    // Tenant A data
    const customerA = await createCustomer(tenantA.id, { email: 'a@a.com' });
    const ticketA = await createTicket(tenantA.id, {
      customer_id: customerA.id,
      subject: 'Tenant A ticket',
    });
    await createMessage(ticketA.id, tenantA.id, { body: 'A message' });
    await createKnowledgeArticle(tenantA.id, { title: 'A article' });
    await createDraft(ticketA.id, tenantA.id, { draft_response: 'A draft' });
    await createTenantProvider(tenantA.id);

    // Tenant B data
    const customerB = await createCustomer(tenantB.id, { email: 'b@b.com' });
    const ticketB = await createTicket(tenantB.id, {
      customer_id: customerB.id,
      subject: 'Tenant B ticket',
    });
    await createMessage(ticketB.id, tenantB.id, { body: 'B message' });
    await createKnowledgeArticle(tenantB.id, { title: 'B article' });
    await createDraft(ticketB.id, tenantB.id, { draft_response: 'B draft' });
    await createTenantProvider(tenantB.id);
  });

  it('tenant A cannot access tenant B tickets endpoint', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.id}/tickets`)
      .set('X-API-Key', tenantA.api_key);

    expect(res.status).toBe(403);
  });

  it('tenant A cannot access tenant B customers endpoint', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.id}/customers`)
      .set('X-API-Key', tenantA.api_key);

    expect(res.status).toBe(403);
  });

  it('tenant A cannot access tenant B knowledge articles endpoint', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.id}/knowledge-articles`)
      .set('X-API-Key', tenantA.api_key);

    expect(res.status).toBe(403);
  });

  it('tenant A cannot access tenant B providers endpoint', async () => {
    const res = await request
      .get(`/api/v1/tenants/${tenantB.id}/providers`)
      .set('X-API-Key', tenantA.api_key);

    expect(res.status).toBe(403);
  });

  it('tenant A list endpoints only return own data', async () => {
    const ticketsRes = await request
      .get(`/api/v1/tenants/${tenantA.id}/tickets`)
      .set('X-API-Key', tenantA.api_key);

    expect(ticketsRes.status).toBe(200);
    expect(ticketsRes.body.data).toHaveLength(1);
    expect(ticketsRes.body.data[0].subject).toBe('Tenant A ticket');

    const customersRes = await request
      .get(`/api/v1/tenants/${tenantA.id}/customers`)
      .set('X-API-Key', tenantA.api_key);

    expect(customersRes.status).toBe(200);
    expect(customersRes.body.data).toHaveLength(1);
    expect(customersRes.body.data[0].email).toBe('a@a.com');

    const articlesRes = await request
      .get(`/api/v1/tenants/${tenantA.id}/knowledge-articles`)
      .set('X-API-Key', tenantA.api_key);

    expect(articlesRes.status).toBe(200);
    expect(articlesRes.body.data).toHaveLength(1);
    expect(articlesRes.body.data[0].title).toBe('A article');
  });

  it('tenant B list endpoints only return own data', async () => {
    const ticketsRes = await request
      .get(`/api/v1/tenants/${tenantB.id}/tickets`)
      .set('X-API-Key', tenantB.api_key);

    expect(ticketsRes.status).toBe(200);
    expect(ticketsRes.body.data).toHaveLength(1);
    expect(ticketsRes.body.data[0].subject).toBe('Tenant B ticket');

    const customersRes = await request
      .get(`/api/v1/tenants/${tenantB.id}/customers`)
      .set('X-API-Key', tenantB.api_key);

    expect(customersRes.status).toBe(200);
    expect(customersRes.body.data).toHaveLength(1);
    expect(customersRes.body.data[0].email).toBe('b@b.com');

    const articlesRes = await request
      .get(`/api/v1/tenants/${tenantB.id}/knowledge-articles`)
      .set('X-API-Key', tenantB.api_key);

    expect(articlesRes.status).toBe(200);
    expect(articlesRes.body.data).toHaveLength(1);
    expect(articlesRes.body.data[0].title).toBe('B article');
  });
});
