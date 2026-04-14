import crypto from 'crypto';
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import supertest from 'supertest';

// Mock the webhook handler to prevent async background processing during tests
vi.mock('../../src/services/webhookHandler.service', () => ({
  handleEvent: vi.fn().mockResolvedValue(undefined),
}));

import { setupTestDb, truncateAll, teardownTestDb } from '../helpers/testDb';
import { createTenant, createApp } from '../helpers/fixtures';

let request: ReturnType<typeof supertest>;

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
  beforeAll(async () => {
    await setupTestDb();
    const mod = await import('../../src/index');
    request = supertest(mod.createApp());
  });
  afterAll(async () => { await teardownTestDb(); });
  beforeEach(async () => { await truncateAll(); });

  describe('POST /webhooks/:tenantSlug/:appId', () => {
    it('should return 200 with valid HMAC signature', async () => {
      const clientSecret = 'my-intercom-client-secret';
      const tenant = await createTenant({ slug: 'wh-tenant' });
      const appRecord = await createApp(tenant.id, {
        code: 'intercom',
        type: 'ticket',
        role: 'both',
        credentials: { accessToken: 'tok', clientSecret },
        webhook_secret: 'wh-secret',
      });

      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);
      const signature = computeHmacSignature(clientSecret, body);

      const res = await request
        .post(`/webhooks/${tenant.slug}/${appRecord.id}`)
        .set('X-Hub-Signature', signature)
        .type('application/json')
        .send(body);

      expect(res.status).toBe(200);
    });

    it('should return 401 with invalid HMAC signature', async () => {
      const clientSecret = 'my-intercom-client-secret';
      const tenant = await createTenant({ slug: 'wh-invalid' });
      const appRecord = await createApp(tenant.id, {
        code: 'intercom',
        type: 'ticket',
        role: 'both',
        credentials: { accessToken: 'tok', clientSecret },
        webhook_secret: 'wh-secret',
      });

      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);

      const res = await request
        .post(`/webhooks/${tenant.slug}/${appRecord.id}`)
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', 'sha1=invalidsignature')
        .send(Buffer.from(body));

      expect(res.status).toBe(401);
    });

    it('should return 404 for unknown tenant slug', async () => {
      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);

      const res = await request
        .post('/webhooks/nonexistent-slug/1')
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', 'sha1=anything')
        .send(Buffer.from(body));

      expect(res.status).toBe(404);
    });

    it('should return 400 when app is not configured', async () => {
      const tenant = await createTenant({ slug: 'wh-noapp' });

      const payload = buildIntercomPayload();
      const body = JSON.stringify(payload);

      const res = await request
        .post(`/webhooks/${tenant.slug}/00000000-0000-0000-0000-000000000000`)
        .set('Content-Type', 'application/json')
        .set('X-Hub-Signature', 'sha1=anything')
        .send(Buffer.from(body));

      expect(res.status).toBe(400);
    });
  });
});
