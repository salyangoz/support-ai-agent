import { Tenant, TenantProvider, TenantSettings } from '../models/types';
import { WebhookEvent } from '../providers/provider.interface';
import { embed } from './embedding.service';
import { generateDraft, sendDraft } from './aiDraft.service';
import * as customerRepo from '../repositories/customer.repository';
import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';
import { defaults } from '../config';
import { logger } from '../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function handleEvent(
  tenant: Tenant,
  providerConfig: TenantProvider,
  event: WebhookEvent,
) {
  logger.info('Webhook event received', {
    tenantId: tenant.id,
    provider: providerConfig.provider,
    eventType: event.type,
  });

  switch (event.type) {
    case 'new_ticket':
      await handleNewTicket(tenant, providerConfig, event);
      break;
    case 'new_customer_reply':
      await handleNewCustomerReply(tenant, providerConfig, event);
      break;
    case 'ticket_closed':
      await handleTicketClosed(tenant, providerConfig, event);
      break;
    case 'ticket_assigned':
      await handleTicketAssigned(tenant, providerConfig, event);
      break;
    default:
      logger.warn('Unknown webhook event type', { eventType: event.type });
  }
}

async function handleNewTicket(
  tenant: Tenant,
  providerConfig: TenantProvider,
  event: WebhookEvent,
) {
  const customer = await findOrCreateCustomerFromEvent(tenant.id, event);

  await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    provider: providerConfig.provider,
    externalId: event.ticketExternalId,
    state: event.data.state || 'open',
    subject: event.data.subject,
    initialBody: event.data.latestMessageBody,
    assigneeId: event.data.assigneeId,
    customerId: customer?.id,
    externalCreatedAt: event.data.createdAt,
  });
}

async function handleNewCustomerReply(
  tenant: Tenant,
  providerConfig: TenantProvider,
  event: WebhookEvent,
) {
  const customer = await findOrCreateCustomerFromEvent(tenant.id, event);

  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    provider: providerConfig.provider,
    externalId: event.ticketExternalId,
    customerId: customer?.id,
  });

  await messageRepo.upsertMessage({
    ticketId: ticket.id,
    tenantId: tenant.id,
    externalId: event.data.latestMessageExternalId || event.ticketExternalId,
    authorRole: 'customer',
    authorId: event.data.latestMessageAuthorId,
    authorName: event.data.latestMessageAuthorName,
    body: event.data.latestMessageBody,
  });

  const draft = await generateDraft(tenant, ticket.id);

  const autoSend = getSetting(tenant, 'auto_send_drafts', defaults.autoSendDrafts);
  if (autoSend && draft) {
    await sendDraft(tenant, draft.id);
  }
}

async function handleTicketClosed(
  tenant: Tenant,
  providerConfig: TenantProvider,
  event: WebhookEvent,
) {
  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    provider: providerConfig.provider,
    externalId: event.ticketExternalId,
  });

  await ticketRepo.updateTicketState(tenant.id, ticket.id, 'closed');

  await embedClosedTicketMessages(tenant.id, ticket.id);
}

async function embedClosedTicketMessages(tenantId: number, ticketId: number) {
  const messages = await messageRepo.findMessagesByTicketId(ticketId, tenantId);
  const agentMessagesWithoutEmbedding = messages.filter(
    (m: any) => m.authorRole === 'agent' && !m.embedding && m.body,
  );

  for (const msg of agentMessagesWithoutEmbedding) {
    if (!msg.body) {
      continue;
    }
    const embedding = await embed(msg.body);
    if (embedding) {
      await messageRepo.updateMessageEmbedding(msg.id, embedding);
    }
  }
}

async function handleTicketAssigned(
  tenant: Tenant,
  providerConfig: TenantProvider,
  event: WebhookEvent,
) {
  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    provider: providerConfig.provider,
    externalId: event.ticketExternalId,
  });

  if (event.data.assigneeId) {
    await ticketRepo.updateTicketAssignee(tenant.id, ticket.id, event.data.assigneeId);
  }
}

async function findOrCreateCustomerFromEvent(tenantId: number, event: WebhookEvent) {
  if (!event.data.customerEmail) {
    return null;
  }

  return customerRepo.upsertCustomer({
    tenantId,
    email: event.data.customerEmail,
    name: event.data.customerName,
  });
}
