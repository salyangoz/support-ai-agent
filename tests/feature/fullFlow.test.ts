import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';

let request: ReturnType<typeof supertest>;
const ADMIN_KEY = 'test-admin-key';

describe('Full Flow: Tenant Setup, User Auth & Configuration', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  it('should complete the full tenant setup and user flow', async () => {
    // ─── 1. Admin creates a tenant ───
    const tenantRes = await request
      .post('/tenants')
      .set('X-API-Key', ADMIN_KEY)
      .send({ name: 'Acme Corp', slug: 'acme-corp' });

    expect(tenantRes.status).toBe(201);
    expect(tenantRes.body.name).toBe('Acme Corp');
    expect(tenantRes.body.slug).toBe('acme-corp');
    expect(tenantRes.body.api_key).toBeDefined();
    expect(tenantRes.body.id).toBeDefined();

    const tenantId = tenantRes.body.id;
    const tenantApiKey = tenantRes.body.api_key;

    // ─── 2. Admin creates the owner user ───
    const ownerRes = await request
      .post(`/tenants/${tenantId}/users/owner`)
      .set('X-API-Key', ADMIN_KEY)
      .send({
        email: 'owner@acme.com',
        password: 'ownerpass123',
        name: 'Alice Owner',
      });

    expect(ownerRes.status).toBe(201);
    expect(ownerRes.body.user).toBeDefined();
    expect(ownerRes.body.user.email).toBe('owner@acme.com');
    expect(ownerRes.body.user.password_hash).toBeUndefined();
    expect(ownerRes.body.tenant_user).toBeDefined();
    expect(ownerRes.body.tenant_user.role).toBe('owner');

    // ─── 3. Owner logs in ───
    const loginRes = await request
      .post('/auth/login')
      .send({ email: 'owner@acme.com', password: 'ownerpass123' });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.access_token).toBeDefined();
    expect(loginRes.body.refresh_token).toBeDefined();
    expect(loginRes.body.user.email).toBe('owner@acme.com');
    expect(loginRes.body.tenants).toHaveLength(1);
    expect(loginRes.body.tenants[0].slug).toBe('acme-corp');
    expect(loginRes.body.tenants[0].role).toBe('owner');

    const ownerToken = loginRes.body.access_token;
    const refreshToken = loginRes.body.refresh_token;

    // ─── 4. Owner gets their profile ───
    const meRes = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.email).toBe('owner@acme.com');
    expect(meRes.body.tenants).toHaveLength(1);
    expect(meRes.body.password_hash).toBeUndefined();

    // ─── 5. Admin configures tenant settings ───
    const settingsRes = await request
      .put(`/tenants/${tenantId}`)
      .set('X-API-Key', ADMIN_KEY)
      .send({
        settings: {
          ai_model: 'gpt-4',
          draft_tone: 'friendly',
          rag_top_k: 10,
          default_language: 'en',
        },
      });

    expect(settingsRes.status).toBe(200);
    expect(settingsRes.body.settings.ai_model).toBe('gpt-4');
    expect(settingsRes.body.settings.draft_tone).toBe('friendly');
    expect(settingsRes.body.settings.rag_top_k).toBe(10);

    // ─── 6. Owner creates a source app (Intercom input) ───
    const sourceAppRes = await request
      .post(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'intercom',
        type: 'ticket',
        role: 'source',
        name: 'Intercom Source',
        credentials: { accessToken: 'ic-token-1', clientSecret: 'ic-secret-1' },
        webhook_secret: 'whsec-source',
      });

    expect(sourceAppRes.status).toBe(201);
    expect(sourceAppRes.body.code).toBe('intercom');
    expect(sourceAppRes.body.role).toBe('source');
    expect(sourceAppRes.body.type).toBe('ticket');

    // ─── 7. Owner creates a destination app (Intercom output) ───
    const destAppRes = await request
      .post(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'intercom',
        type: 'ticket',
        role: 'destination',
        name: 'Intercom Destination',
        credentials: { accessToken: 'ic-token-2' },
      });

    expect(destAppRes.status).toBe(201);
    expect(destAppRes.body.role).toBe('destination');

    // ─── 8. Owner creates a knowledge base app ───
    const kbAppRes = await request
      .post(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        code: 'notion',
        type: 'knowledge',
        role: 'source',
        name: 'Notion KB',
        credentials: { apiKey: 'notion-api-key' },
      });

    expect(kbAppRes.status).toBe(201);
    expect(kbAppRes.body.type).toBe('knowledge');
    expect(kbAppRes.body.code).toBe('notion');

    // ─── 9. Owner lists all apps — should see 3 ───
    const appsListRes = await request
      .get(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(appsListRes.status).toBe(200);
    expect(appsListRes.body).toHaveLength(3);

    // ─── 10. Owner creates knowledge articles ───
    const article1Res = await request
      .post(`/tenants/${tenantId}/knowledge-articles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'How to reset your password',
        content: 'Go to settings, click "Security", then "Reset Password".',
        category: 'account',
        language: 'en',
      });

    expect(article1Res.status).toBe(201);
    expect(article1Res.body.title).toBe('How to reset your password');

    const article2Res = await request
      .post(`/tenants/${tenantId}/knowledge-articles`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        title: 'Billing FAQ',
        content: 'You can manage billing from your account dashboard.',
        category: 'billing',
        language: 'en',
      });

    expect(article2Res.status).toBe(201);

    // ─── 11. Owner lists knowledge articles ───
    const articlesListRes = await request
      .get(`/tenants/${tenantId}/knowledge-articles`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(articlesListRes.status).toBe(200);
    expect(articlesListRes.body.data).toHaveLength(2);

    // ─── 12. Owner creates a customer ───
    const customerRes = await request
      .post(`/tenants/${tenantId}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'john@customer.com',
        name: 'John Doe',
        phone: '+1234567890',
        metadata: { plan: 'enterprise' },
      });

    expect(customerRes.status).toBe(201);
    expect(customerRes.body.email).toBe('john@customer.com');
    expect(customerRes.body.name).toBe('John Doe');

    // ─── 13. Owner lists customers ───
    const customersListRes = await request
      .get(`/tenants/${tenantId}/customers`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(customersListRes.status).toBe(200);
    expect(customersListRes.body.data).toHaveLength(1);

    // ─── 14. Owner invites an admin user ───
    const adminInviteRes = await request
      .post(`/tenants/${tenantId}/users`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'admin@acme.com',
        password: 'adminpass123',
        name: 'Bob Admin',
        role: 'admin',
      });

    expect(adminInviteRes.status).toBe(201);
    expect(adminInviteRes.body.tenant_user.role).toBe('admin');

    // ─── 15. Owner invites a member user ───
    const memberInviteRes = await request
      .post(`/tenants/${tenantId}/users`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        email: 'member@acme.com',
        password: 'memberpass123',
        name: 'Charlie Member',
        role: 'member',
      });

    expect(memberInviteRes.status).toBe(201);
    expect(memberInviteRes.body.tenant_user.role).toBe('member');

    // ─── 16. Admin user logs in and can access tenant data ───
    const adminLoginRes = await request
      .post('/auth/login')
      .send({ email: 'admin@acme.com', password: 'adminpass123' });

    expect(adminLoginRes.status).toBe(200);
    const adminToken = adminLoginRes.body.access_token;

    const adminAppsRes = await request
      .get(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(adminAppsRes.status).toBe(200);
    expect(adminAppsRes.body).toHaveLength(3);

    // Admin can also create apps
    const adminAppRes = await request
      .post(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'intercom',
        type: 'ticket',
        role: 'both',
        credentials: { subdomain: 'acme', apiToken: 'zd-token' },
      });

    expect(adminAppRes.status).toBe(201);

    // ─── 17. Member user is blocked from creating apps ───
    const memberLoginRes = await request
      .post('/auth/login')
      .send({ email: 'member@acme.com', password: 'memberpass123' });

    expect(memberLoginRes.status).toBe(200);
    const memberToken = memberLoginRes.body.access_token;

    const memberCreateAppRes = await request
      .post(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({
        code: 'intercom',
        type: 'ticket',
        role: 'both',
        credentials: { accessToken: 'blocked' },
      });

    expect(memberCreateAppRes.status).toBe(403);

    // Member is also blocked from creating knowledge articles
    const memberCreateArticleRes = await request
      .post(`/tenants/${tenantId}/knowledge-articles`)
      .set('Authorization', `Bearer ${memberToken}`)
      .send({ title: 'Blocked', content: 'Should not work' });

    expect(memberCreateArticleRes.status).toBe(403);

    // ─── 18. Member CAN read customers and apps ───
    const memberCustomersRes = await request
      .get(`/tenants/${tenantId}/customers`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(memberCustomersRes.status).toBe(200);
    expect(memberCustomersRes.body.data).toHaveLength(1);

    const memberAppsRes = await request
      .get(`/tenants/${tenantId}/apps`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(memberAppsRes.status).toBe(200);

    // ─── 19. Token refresh works ───
    const refreshRes = await request
      .post('/auth/refresh')
      .send({ refresh_token: refreshToken });

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.access_token).toBeDefined();
    expect(refreshRes.body.refresh_token).toBeDefined();

    // New token works
    const newTokenMeRes = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${refreshRes.body.access_token}`);

    expect(newTokenMeRes.status).toBe(200);
    expect(newTokenMeRes.body.email).toBe('owner@acme.com');

    // ─── 20. Tenant isolation: user of tenant A cannot access tenant B ───
    const tenant2Res = await request
      .post('/tenants')
      .set('X-API-Key', ADMIN_KEY)
      .send({ name: 'Other Corp', slug: 'other-corp' });

    expect(tenant2Res.status).toBe(201);
    const tenantBId = tenant2Res.body.id;

    // Owner of tenant A tries to access tenant B
    const crossTenantRes = await request
      .get(`/tenants/${tenantBId}/apps`)
      .set('Authorization', `Bearer ${ownerToken}`);

    expect(crossTenantRes.status).toBe(403);

    // Member of tenant A tries to access tenant B
    const crossTenantMemberRes = await request
      .get(`/tenants/${tenantBId}/customers`)
      .set('Authorization', `Bearer ${memberToken}`);

    expect(crossTenantMemberRes.status).toBe(403);

    // ─── 21. API key auth still works (backward compatibility) ───
    const apiKeyAppsRes = await request
      .get(`/tenants/${tenantId}/apps`)
      .set('X-API-Key', tenantApiKey);

    expect(apiKeyAppsRes.status).toBe(200);
    expect(apiKeyAppsRes.body.length).toBeGreaterThanOrEqual(3);

    // API key auth for creating customers also works
    const apiKeyCustomerRes = await request
      .post(`/tenants/${tenantId}/customers`)
      .set('X-API-Key', tenantApiKey)
      .send({ email: 'apikey-customer@test.com', name: 'API Key Customer' });

    expect(apiKeyCustomerRes.status).toBe(201);
  });

  it('should prevent duplicate owner creation', async () => {
    // Create tenant and owner
    const tenantRes = await request
      .post('/tenants')
      .set('X-API-Key', ADMIN_KEY)
      .send({ name: 'Unique Corp', slug: 'unique-corp' });

    const tenantId = tenantRes.body.id;

    await request
      .post(`/tenants/${tenantId}/users/owner`)
      .set('X-API-Key', ADMIN_KEY)
      .send({ email: 'first-owner@test.com', password: 'password123', name: 'First' });

    // Try to create a second owner — should fail
    const secondOwnerRes = await request
      .post(`/tenants/${tenantId}/users/owner`)
      .set('X-API-Key', ADMIN_KEY)
      .send({ email: 'second-owner@test.com', password: 'password123', name: 'Second' });

    expect(secondOwnerRes.status).toBe(400);
  });

  it('should allow a user to belong to multiple tenants', async () => {
    // Create two tenants
    const t1Res = await request
      .post('/tenants')
      .set('X-API-Key', ADMIN_KEY)
      .send({ name: 'Tenant One', slug: 'tenant-one' });
    const t1Id = t1Res.body.id;

    const t2Res = await request
      .post('/tenants')
      .set('X-API-Key', ADMIN_KEY)
      .send({ name: 'Tenant Two', slug: 'tenant-two' });
    const t2Id = t2Res.body.id;

    // Create owner in tenant 1
    await request
      .post(`/tenants/${t1Id}/users/owner`)
      .set('X-API-Key', ADMIN_KEY)
      .send({ email: 'multi@test.com', password: 'password123', name: 'Multi User' });

    // Same user becomes admin in tenant 2 (via admin bootstrap since they already exist)
    const t2OwnerRes = await request
      .post(`/tenants/${t2Id}/users/owner`)
      .set('X-API-Key', ADMIN_KEY)
      .send({ email: 'multi-t2-owner@test.com', password: 'password123', name: 'T2 Owner' });
    expect(t2OwnerRes.status).toBe(201);

    // T2 owner logs in and invites multi@test.com
    const t2LoginRes = await request
      .post('/auth/login')
      .send({ email: 'multi-t2-owner@test.com', password: 'password123' });
    const t2OwnerToken = t2LoginRes.body.access_token;

    const inviteRes = await request
      .post(`/tenants/${t2Id}/users`)
      .set('Authorization', `Bearer ${t2OwnerToken}`)
      .send({ email: 'multi@test.com', password: 'irrelevant', name: 'Multi User', role: 'admin' });

    expect(inviteRes.status).toBe(201);

    // Multi user logs in — should see both tenants
    const multiLoginRes = await request
      .post('/auth/login')
      .send({ email: 'multi@test.com', password: 'password123' });

    expect(multiLoginRes.status).toBe(200);
    expect(multiLoginRes.body.tenants).toHaveLength(2);

    const multiToken = multiLoginRes.body.access_token;

    // Can access tenant 1 data
    const t1AppsRes = await request
      .get(`/tenants/${t1Id}/apps`)
      .set('Authorization', `Bearer ${multiToken}`);
    expect(t1AppsRes.status).toBe(200);

    // Can access tenant 2 data
    const t2AppsRes = await request
      .get(`/tenants/${t2Id}/apps`)
      .set('Authorization', `Bearer ${multiToken}`);
    expect(t2AppsRes.status).toBe(200);
  });

  it('should reject invalid login credentials', async () => {
    const res = await request
      .post('/auth/login')
      .send({ email: 'nobody@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('should reject requests without authentication', async () => {
    const tenantRes = await request
      .post('/tenants')
      .set('X-API-Key', ADMIN_KEY)
      .send({ name: 'No Auth Corp', slug: 'no-auth-corp' });

    const tenantId = tenantRes.body.id;

    const res = await request.get(`/tenants/${tenantId}/apps`);
    expect(res.status).toBe(401);
  });
});
