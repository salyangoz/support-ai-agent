import crypto from 'crypto';
import { WebhookEvent } from '../app.interface';
import { IntercomWebhookPayload } from './intercom.types';

const TOPIC_MAP: Record<string, WebhookEvent['type']> = {
  'conversation.user.created': 'new_ticket',
  'conversation.user.replied': 'new_customer_reply',
  'conversation.admin.closed': 'ticket_closed',
  'conversation.admin.assigned': 'ticket_assigned',
};

export function verifyIntercomWebhook(
  rawBody: Buffer,
  headers: Record<string, any>,
  clientSecret: string,
): boolean {
  const signature = headers['x-hub-signature'] as string | undefined;
  if (!signature || !signature.startsWith('sha1=')) {
    return false;
  }

  const hmac = crypto.createHmac('sha1', clientSecret);
  hmac.update(rawBody);
  const computed = `sha1=${hmac.digest('hex')}`;

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computed),
      Buffer.from(signature),
    );
  } catch {
    return false;
  }
}

export function parseIntercomWebhook(
  payload: IntercomWebhookPayload,
): WebhookEvent | null {
  const eventType = TOPIC_MAP[payload.topic];
  if (!eventType) {
    return null;
  }

  const item = payload.data?.item;
  if (!item) {
    return null;
  }

  const contact = item.contacts?.contacts?.[0] || item.user;
  const parts = item.conversation_parts?.conversation_parts || [];
  const latestPart = parts[parts.length - 1];

  return {
    type: eventType,
    ticketExternalId: String(item.id),
    data: {
      state: item.state,
      subject: item.title,
      customerEmail: contact?.email,
      customerName: contact?.name,
      customerExternalId: contact?.id ? String(contact.id) : undefined,
      assigneeId: item.assignee?.id ? String(item.assignee.id) : undefined,
      latestMessageBody: latestPart?.body || item.conversation_message?.body || item.source?.body,
      latestMessageExternalId: latestPart?.id ? String(latestPart.id) : undefined,
      latestMessageAuthorType: latestPart?.author?.type || 'user',
      latestMessageAuthorId: latestPart?.author?.id ? String(latestPart.author.id) : undefined,
      latestMessageAuthorName: latestPart?.author?.name,
      latestMessageAttachments: latestPart?.attachments || item.source?.attachments || [],
      createdAt: payload.created_at,
    },
  };
}
