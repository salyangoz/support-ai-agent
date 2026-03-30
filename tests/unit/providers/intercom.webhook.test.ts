import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import { verifyIntercomWebhook, parseIntercomWebhook } from '../../../src/providers/intercom/intercom.webhook';

function createSignature(body: string, secret: string): string {
  const hmac = crypto.createHmac('sha1', secret);
  hmac.update(body, 'utf-8');
  return `sha1=${hmac.digest('hex')}`;
}

const samplePayload = {
  type: 'notification_event',
  topic: 'conversation.user.replied',
  data: {
    type: 'notification_event_data',
    item: {
      type: 'conversation',
      id: '123456',
      state: 'open',
      user: {
        type: 'user',
        id: 'user-1',
        email: 'jane@example.com',
        name: 'Jane Doe',
      },
      conversation_message: {
        body: '<p>Original message</p>',
        author: { type: 'user', id: 'user-1' },
      },
      conversation_parts: {
        conversation_parts: [
          {
            id: 'part-1',
            part_type: 'comment',
            body: '<p>Latest reply</p>',
            author: { type: 'user', id: 'user-1', name: 'Jane Doe' },
            created_at: 1700000000,
          },
        ],
      },
    },
  },
  created_at: 1700000000,
};

describe('Intercom Webhook Verification', () => {
  const secret = 'test-client-secret';

  it('should accept valid HMAC-SHA1 signature', () => {
    const body = JSON.stringify(samplePayload);
    const rawBody = Buffer.from(body);
    const signature = createSignature(body, secret);

    const result = verifyIntercomWebhook(rawBody, { 'x-hub-signature': signature }, secret);
    expect(result).toBe(true);
  });

  it('should reject invalid signature', () => {
    const body = JSON.stringify(samplePayload);
    const rawBody = Buffer.from(body);

    const result = verifyIntercomWebhook(rawBody, { 'x-hub-signature': 'sha1=invalid' }, secret);
    expect(result).toBe(false);
  });

  it('should reject missing signature header', () => {
    const rawBody = Buffer.from(JSON.stringify(samplePayload));

    const result = verifyIntercomWebhook(rawBody, {}, secret);
    expect(result).toBe(false);
  });

  it('should reject wrong prefix format', () => {
    const body = JSON.stringify(samplePayload);
    const rawBody = Buffer.from(body);
    const hmac = crypto.createHmac('sha1', secret);
    hmac.update(body, 'utf-8');
    const digest = hmac.digest('hex');

    const result = verifyIntercomWebhook(rawBody, { 'x-hub-signature': digest }, secret);
    expect(result).toBe(false);
  });
});

describe('Intercom Webhook Parsing', () => {
  it('should parse conversation.user.replied as new_customer_reply', () => {
    const event = parseIntercomWebhook(samplePayload);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('new_customer_reply');
    expect(event!.ticketExternalId).toBe('123456');
  });

  it('should parse conversation.user.created as new_ticket', () => {
    const payload = { ...samplePayload, topic: 'conversation.user.created' };
    const event = parseIntercomWebhook(payload);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('new_ticket');
  });

  it('should parse conversation.admin.closed as ticket_closed', () => {
    const payload = { ...samplePayload, topic: 'conversation.admin.closed' };
    const event = parseIntercomWebhook(payload);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('ticket_closed');
  });

  it('should parse conversation.admin.assigned as ticket_assigned', () => {
    const payload = { ...samplePayload, topic: 'conversation.admin.assigned' };
    const event = parseIntercomWebhook(payload);
    expect(event).not.toBeNull();
    expect(event!.type).toBe('ticket_assigned');
  });

  it('should return null for unknown topic', () => {
    const payload = { ...samplePayload, topic: 'user.created' };
    const event = parseIntercomWebhook(payload);
    expect(event).toBeNull();
  });

  it('should extract customer data from payload', () => {
    const event = parseIntercomWebhook(samplePayload);
    expect(event!.data.customerEmail).toBe('jane@example.com');
    expect(event!.data.customerName).toBe('Jane Doe');
    expect(event!.data.customerExternalId).toBe('user-1');
  });
});
