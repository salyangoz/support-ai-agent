import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import supertest from 'supertest';
import { createApp } from '../../src/index';
import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createTenantProvider } from '../helpers/fixtures';

const app = createApp();
const request = supertest(app);

function buildIntercomPayload(): Record<string, any> {
  return {
    type: 'notification_event',
    topic: 'conversation.user.created',
    id: 'notif_123',
    created_at: Math.floor(Date.now() / 1000),
    delivery_status: 'pending',
    delivery_attempts: 1,
    data: {
      type: 'notification_event_data',
      item: {
        type: 'conversation',
        id: 'conv_456',
        state: 'open',
        title: 'New conversation',
        contacts: {
          contacts: [
            { id: 'contact_1', email: 'user@example.com', name: 'Test User' },
          ],
        },
        conversation_message: {
          body: 'Hello, I need help!',
        },
      },
    },
  };
}

function computeHmacSignature(secret: string, body: string): string {
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(body);
  return `sha1=${hmac.digest('hex')}`;
}

describe('Feature: Webhooks', () => {
  beforeAll(async () => { await setupTestDb(); });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('POST /webhooks/:tenantSlug/:provider', () => {
    it('should return 200 with valid HMAC signature', async () => {
      const clientSecret = 'my-intercom-client-secret';
      const tenant = await createTenant({ slug: 'wh-tenant' });
      await createTenantProvider(tenant.id, {
        provider: 'intercom',
        credentials: JSON.stringify({ accessToken: 'tok', clientSecret }),
        webhook_secret: 'wh-secret',
      });

      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(clientSecret, body);

      const res = await request
        .post(`/webhooks/${tenant.slug}/intercom`)
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', signature)
        .send(Buffer.from(body));

      expect(res.status).toBe(200);
    });

    it('should return 401 with invalid HMAC signature', async () => {
      const clientSecret = 'my-intercom-client-secret';
      const tenant = await createTenant({ slug: 'wh-invalid' });
      await createTenantProvider(tenant.id, {
        provider: 'intercom',
        credentials: JSON.stringify({ accessToken: 'tok', clientSecret }),
        webhook_secret: 'wh-secret',
      });

      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);

      const res = await request
        .post(`/webhooks/${tenant.slug}/intercom`)
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', 'sha1=invalidsignature')
        .send(Buffer.from(body));

      expect(res.status).toBe(401);
    });

    it('should return 404 for unknown tenant slug', async () => {
      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);

      const res = await request
        .post('/webhooks/nonexistent-slug/intercom')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', 'sha1=anything')
        .send(Buffer.from(body));

      expect(res.status).toBe(404);
    });

    it('should return 400 when provider is not configured', async () => {
      const tenant = await createTenant({ slug: 'wh-noprov' });

      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);

      const res = await request
        .post(`/webhooks/${tenant.slug}/intercom`)
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', 'sha1=anything')
        .send(Buffer.from(body));

      expect(res.status).toBe(400);
    });
  });
});
