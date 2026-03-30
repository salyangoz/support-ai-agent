import { createProvider } from '../providers/provider.factory';
import { embed } from './embedding.service';
import * as customerRepo from '../repositories/customer.repository';
import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';
import * as tenantRepo from '../repositories/tenant.repository';
import { Tenant, TenantProvider, TenantSettings } from '../models/types';
import { defaults } from '../config';
import { logger } from '../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function syncTenantProvider(
  tenant: Tenant,
  providerConfig: TenantProvider,
) {
  const credentials = providerConfig.credentials as Record<string, any>;
  const adapter = createProvider({ ...credentials, provider: providerConfig.provider });
  const lookbackMinutes = getSetting(
    tenant,
    'sync_lookback_minutes',
    defaults.syncLookbackMinutes,
  );

  const tickets = await adapter.fetchRecentTickets(lookbackMinutes);

  for (const ticket of tickets) {
    const customer = await findOrCreateCustomer(tenant.id, ticket);
    const upsertedTicket = await upsertTicketFromSync(tenant.id, providerConfig.provider, ticket, customer?.id);
    await syncTicketMessages(adapter, tenant.id, upsertedTicket.id, ticket.externalId);
  }
}

async function findOrCreateCustomer(tenantId: number, ticket: any) {
  if (!ticket.customerEmail) {
    return null;
  }

  return customerRepo.upsertCustomer({
    tenantId,
    email: ticket.customerEmail,
    name: ticket.customerName,
  });
}

async function upsertTicketFromSync(
  tenantId: number,
  provider: string,
  ticket: any,
  customerId?: number,
) {
  return ticketRepo.upsertTicket({
    tenantId,
    provider,
    externalId: ticket.externalId,
    state: ticket.state,
    subject: ticket.subject,
    initialBody: ticket.initialBody,
    language: ticket.language,
    assigneeId: ticket.assigneeId,
    customerId,
    externalCreatedAt: ticket.externalCreatedAt,
    externalUpdatedAt: ticket.externalUpdatedAt,
  });
}

async function syncTicketMessages(
  adapter: any,
  tenantId: number,
  ticketId: number,
  externalTicketId: string,
) {
  const messages = await adapter.fetchTicketMessages(externalTicketId);

  for (const msg of messages) {
    const upserted = await messageRepo.upsertMessage({
      ticketId,
      tenantId,
      externalId: msg.externalId,
      authorRole: msg.authorRole,
      authorId: msg.authorId,
      authorName: msg.authorName,
      body: msg.body,
      externalCreatedAt: msg.externalCreatedAt,
    });

    if (msg.authorRole === 'agent' && msg.body) {
      const embedding = await embed(msg.body);
      if (embedding) {
        await messageRepo.updateMessageEmbedding(upserted.id, embedding);
      }
    }
  }
}

export async function backfillMissingEmbeddings() {
  const tenants = await tenantRepo.findAllActiveTenants();

  for (const tenant of tenants) {
    const messages = await messageRepo.findMessagesWithoutEmbedding(tenant.id);

    for (const msg of messages) {
      if (!msg.body) {
        continue;
      }

      const embedding = await embed(msg.body);
      if (embedding) {
        await messageRepo.updateMessageEmbedding(msg.id, embedding);
        logger.info('Backfilled embedding', { tenantId: tenant.id, messageId: msg.id });
      }
    }
  }
}
