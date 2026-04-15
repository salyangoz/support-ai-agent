import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';

let request: ReturnType<typeof supertest>;

describe('User Tenants', () => {
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  async function registerAndLogin() {
    const reg = await request
      .post('/auth/register')
      .send({ email: 'user@example.com', password: 'securepass123', name: 'Test User' });
    return reg.body.access_token as string;
  }

  async function createTenantAsOwner(token: string, name = 'My Company', slug = 'my-company') {
    const res = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, slug });
    return res.body;
  }

  it('should create a tenant and assign user as owner', async () => {
    const token = await registerAndLogin();

    const res = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Company', slug: 'my-company' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('My Company');
    expect(res.body.slug).toBe('my-company');
    expect(res.body.api_key).toBeDefined();
    expect(res.body.tenant_user).toBeDefined();
    expect(res.body.tenant_user.role).toBe('owner');
  });

  it('should allow the user to access the new tenant', async () => {
    const token = await registerAndLogin();

    await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Company', slug: 'my-company' });

    const meRes = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.tenants).toHaveLength(1);
    expect(meRes.body.tenants[0].slug).toBe('my-company');
    expect(meRes.body.tenants[0].role).toBe('owner');
  });

  it('should return 409 when slug is already taken', async () => {
    const token = await registerAndLogin();

    await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'First', slug: 'same-slug' });

    const res = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Second', slug: 'same-slug' });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/already taken/i);
  });

  it('should return 400 when name or slug is missing', async () => {
    const token = await registerAndLogin();

    const noName = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ slug: 'no-name' });
    expect(noName.status).toBe(400);

    const noSlug = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'No Slug' });
    expect(noSlug.status).toBe(400);
  });

  it('should return 401 without auth token', async () => {
    const res = await request
      .post('/my/tenants')
      .send({ name: 'No Auth', slug: 'no-auth' });

    expect(res.status).toBe(401);
  });

  it('should allow user to create multiple tenants', async () => {
    const token = await registerAndLogin();

    const res1 = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tenant A', slug: 'tenant-a' });
    expect(res1.status).toBe(201);

    const res2 = await request
      .post('/my/tenants')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Tenant B', slug: 'tenant-b' });
    expect(res2.status).toBe(201);

    const meRes = await request
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);
    expect(meRes.body.tenants).toHaveLength(2);
  });

  describe('PATCH /tenants/:tenantId (owner)', () => {
    it('should update tenant name', async () => {
      const token = await registerAndLogin();
      const tenant = await createTenantAsOwner(token);

      const res = await request
        .patch(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(res.body.slug).toBe('my-company');
    });

    it('should partially merge settings', async () => {
      const token = await registerAndLogin();
      const tenant = await createTenantAsOwner(token);

      // Set initial settings
      await request
        .patch(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settings: { ai_service: 'openai', draft_tone: 'friendly' } });

      // Partial update — only change draft_tone
      const res = await request
        .patch(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ settings: { draft_tone: 'formal' } });

      expect(res.status).toBe(200);
      expect(res.body.settings.draft_tone).toBe('formal');
      expect(res.body.settings.ai_service).toBe('openai');
    });

    it('should return 400 when no fields provided', async () => {
      const token = await registerAndLogin();
      const tenant = await createTenantAsOwner(token);

      const res = await request
        .patch(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('should return 403 for non-owner member', async () => {
      const token = await registerAndLogin();
      const tenant = await createTenantAsOwner(token);

      // Register a second user and invite as member
      const reg2 = await request
        .post('/auth/register')
        .send({ email: 'member@example.com', password: 'securepass123', name: 'Member' });
      const memberToken = reg2.body.access_token;

      await request
        .post(`/tenants/${tenant.id}/users`)
        .set('Authorization', `Bearer ${token}`)
        .send({ email: 'member@example.com', password: 'securepass123', name: 'Member', role: 'member' });

      const res = await request
        .patch(`/tenants/${tenant.id}`)
        .set('Authorization', `Bearer ${memberToken}`)
        .send({ name: 'Hacked' });

      expect(res.status).toBe(403);
    });
  });
});
