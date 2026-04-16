import { Tenant, App, TenantSettings } from '../../models/types';
import { WebhookEvent } from '../app.interface';
import { embed } from '../../services/embedding.service';
import { generateDraft, sendDraft } from '../../services/aiDraft.service';
import { generateKbFromTicket } from '../../services/ticketKb.service';
import * as customerRepo from '../../repositories/customer.repository';
import * as ticketRepo from '../../repositories/ticket.repository';
import * as messageRepo from '../../repositories/message.repository';
import { defaults } from '../../config';
import { logger } from '../../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function handleEvent(
  tenant: Tenant,
  app: App,
  event: WebhookEvent,
) {
  logger.info('Webhook event received', {
    tenantId: tenant.id,
    appId: app.id,
    appCode: app.code,
    eventType: event.type,
  });

  switch (event.type) {
    case 'new_ticket':
      await handleNewTicket(tenant, app, event);
      break;
    case 'new_customer_reply':
      await handleNewCustomerReply(tenant, app, event);
      break;
    case 'ticket_closed':
      await handleTicketClosed(tenant, app, event);
      break;
    case 'ticket_assigned':
      await handleTicketAssigned(tenant, app, event);
      break;
    default:
      logger.warn('Unknown webhook event type', { eventType: event.type });
  }
}

async function handleNewTicket(
  tenant: Tenant,
  app: App,
  event: WebhookEvent,
) {
  const customer = await findOrCreateCustomerFromEvent(tenant.id, event);

  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    inputAppId: app.id,
    externalId: event.ticketExternalId,
    state: event.data.state || 'open',
    subject: event.data.subject,
    initialBody: event.data.latestMessageBody,
    assigneeId: event.data.assigneeId,
    customerId: customer?.id,
    externalCreatedAt: event.data.createdAt ? new Date(event.data.createdAt * 1000) : undefined,
  });

  if (event.data.latestMessageBody) {
    await messageRepo.upsertMessage({
      ticketId: ticket.id,
      tenantId: tenant.id,
      externalId: event.data.latestMessageExternalId || `${event.ticketExternalId}-initial`,
      authorRole: 'customer',
      authorId: event.data.latestMessageAuthorId,
      authorName: event.data.latestMessageAuthorName,
      body: event.data.latestMessageBody,
    });

    try {
      const draft = await generateDraft(tenant, ticket.id);

      const autoSend = getSetting(tenant, 'auto_send_drafts', defaults.autoSendDrafts);
      if (autoSend && draft) {
        await sendDraft(tenant, draft.id);
      }
    } catch (err) {
      logger.error('Draft generation failed for new ticket', {
        tenantId: tenant.id,
        ticketId: ticket.id,
        error: (err as Error).message,
      });
    }
  }
}

async function handleNewCustomerReply(
  tenant: Tenant,
  app: App,
  event: WebhookEvent,
) {
  const customer = await findOrCreateCustomerFromEvent(tenant.id, event);

  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    inputAppId: app.id,
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

  try {
    const draft = await generateDraft(tenant, ticket.id);

    const autoSend = getSetting(tenant, 'auto_send_drafts', defaults.autoSendDrafts);
    if (autoSend && draft) {
      await sendDraft(tenant, draft.id);
    }
  } catch (err) {
    logger.error('Draft generation failed for customer reply', {
      tenantId: tenant.id,
      ticketId: ticket.id,
      error: (err as Error).message,
    });
  }
}

async function handleTicketClosed(
  tenant: Tenant,
  app: App,
  event: WebhookEvent,
) {
  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    inputAppId: app.id,
    externalId: event.ticketExternalId,
  });

  await ticketRepo.updateTicketState(tenant.id, ticket.id, 'closed');

  await embedClosedTicketMessages(tenant.id, ticket.id, {
    credentials: tenant.settings.embedding_credentials || tenant.settings.ai_credentials,
    service: tenant.settings.embedding_service,
    model: tenant.settings.embedding_model,
  });

  if (getSetting(tenant, 'auto_generate_kb', false)) {
    try {
      await generateKbFromTicket(tenant, ticket.id);
      logger.info('KB article generated from closed ticket', {
        tenantId: tenant.id,
        ticketId: ticket.id,
      });
    } catch (err) {
      logger.error('Failed to generate KB from closed ticket', {
        tenantId: tenant.id,
        ticketId: ticket.id,
        error: (err as Error).message,
      });
    }
  }
}

async function embedClosedTicketMessages(
  tenantId: string,
  ticketId: string,
  opts?: { credentials?: { api_key?: string }; service?: string; model?: string },
) {
  const messages = await messageRepo.findMessagesByTicketId(ticketId, tenantId);
  const agentMessagesWithoutEmbedding = messages.filter(
    (m: any) => m.authorRole === 'agent' && !m.embedding && m.body,
  );

  for (const msg of agentMessagesWithoutEmbedding) {
    if (!msg.body) {
      continue;
    }
    const embedding = await embed(msg.body, opts?.credentials, opts?.service, opts?.model);
    if (embedding) {
      await messageRepo.updateMessageEmbedding(msg.id, embedding);
    }
  }
}

async function handleTicketAssigned(
  tenant: Tenant,
  app: App,
  event: WebhookEvent,
) {
  const ticket = await ticketRepo.upsertTicket({
    tenantId: tenant.id,
    inputAppId: app.id,
    externalId: event.ticketExternalId,
  });

  if (event.data.assigneeId) {
    await ticketRepo.updateTicketAssignee(tenant.id, ticket.id, event.data.assigneeId);
  }
}

async function findOrCreateCustomerFromEvent(tenantId: string, event: WebhookEvent) {
  if (!event.data.customerEmail) {
    return null;
  }

  return customerRepo.upsertCustomer({
    tenantId,
    email: event.data.customerEmail,
    name: event.data.customerName,
  });
}
