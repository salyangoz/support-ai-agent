import { createInputApp } from '../apps/app.factory';
import { embed } from './embedding.service';
import { generateDraft, sendDraft } from './aiDraft.service';
import { downloadAndStore } from './fileStorage.service';
import * as customerRepo from '../repositories/customer.repository';
import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';
import * as draftRepo from '../repositories/draft.repository';
import * as attachmentRepo from '../repositories/messageAttachment.repository';
import * as tenantRepo from '../repositories/tenant.repository';
import { Tenant, App, TenantSettings } from '../models/types';
import { defaults } from '../config';
import { logger } from '../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function syncInputApp(
  tenant: Tenant,
  app: App,
) {
  const adapter = createInputApp(app);
  const lookbackMinutes = getSetting(
    tenant,
    'sync_lookback_minutes',
    defaults.syncLookbackMinutes,
  );

  const tickets = await adapter.fetchRecentTickets(lookbackMinutes);

  for (const ticket of tickets) {
    const customer = await findOrCreateCustomer(tenant.id, ticket);
    const upsertedTicket = await upsertTicketFromSync(tenant.id, app.id, ticket, customer?.id);
    const hasNewCustomerMessage = await syncTicketMessages(adapter, tenant.id, upsertedTicket.id, ticket.externalId, {
      credentials: tenant.settings.embedding_credentials || tenant.settings.ai_credentials,
      service: tenant.settings.embedding_service,
      model: tenant.settings.embedding_model,
    });

    if (hasNewCustomerMessage) {
      try {
        const existingDrafts = await draftRepo.findDraftsByTicketId(tenant.id, upsertedTicket.id, { limit: 1 });
        const latestDraft = existingDrafts.data[0];
        const messages = await messageRepo.findMessagesByTicketId(upsertedTicket.id, tenant.id);
        const latestCustomerMsg = [...messages].reverse().find((m: any) => m.authorRole === 'customer');

        // Only generate draft if no draft exists yet, or the latest customer message is newer than the latest draft
        const shouldGenerate = !latestDraft
          || (latestCustomerMsg?.createdAt && latestDraft.createdAt < latestCustomerMsg.createdAt);

        if (shouldGenerate) {
          const draft = await generateDraft(tenant, upsertedTicket.id);
          const autoSend = getSetting(tenant, 'auto_send_drafts', defaults.autoSendDrafts);
          if (autoSend && draft) {
            await sendDraft(tenant, draft.id);
          }
        }
      } catch (err) {
        logger.error('Draft generation failed during sync', {
          tenantId: tenant.id,
          ticketId: upsertedTicket.id,
          error: (err as Error).message,
        });
      }
    }
  }
}

async function findOrCreateCustomer(tenantId: string, ticket: any) {
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
  tenantId: string,
  inputAppId: string,
  ticket: any,
  customerId?: string,
) {
  return ticketRepo.upsertTicket({
    tenantId,
    inputAppId,
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

export async function syncTicketMessages(
  adapter: any,
  tenantId: string,
  ticketId: string,
  externalTicketId: string,
  embeddingOpts?: { credentials?: { api_key?: string }; service?: string; model?: string },
): Promise<boolean> {
  const messages = await adapter.fetchTicketMessages(externalTicketId);
  let hasNewCustomerMessage = false;

  for (const msg of messages) {
    // Check if this message already exists
    const existing = await messageRepo.findMessageByExternalId(ticketId, msg.externalId);
    const isNew = !existing;

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

    if (msg.attachments && msg.attachments.length > 0) {
      const withLocalPaths = [];
      for (const att of msg.attachments) {
        const localPath = await downloadAndStore(tenantId, att.url, att.fileName, att.fileType);
        withLocalPaths.push({ ...att, localPath: localPath ?? undefined });
      }
      await attachmentRepo.upsertAttachments(upserted.id, tenantId, withLocalPaths);
    }

    if (isNew && msg.authorRole === 'customer') {
      hasNewCustomerMessage = true;
    }

    if (msg.authorRole === 'agent' && msg.body) {
      const embedding = await embed(msg.body, embeddingOpts?.credentials, embeddingOpts?.service, embeddingOpts?.model);
      if (embedding) {
        await messageRepo.updateMessageEmbedding(upserted.id, embedding);
      }
    }
  }

  return hasNewCustomerMessage;
}

export async function backfillMissingEmbeddings() {
  const tenants = await tenantRepo.findAllActiveTenants();

  for (const tenant of tenants) {
    const messages = await messageRepo.findMessagesWithoutEmbedding(tenant.id);
    const settings = tenant.settings as any;
    const creds = settings?.embedding_credentials || settings?.ai_credentials;

    for (const msg of messages) {
      if (!msg.body) {
        continue;
      }

      const embedding = await embed(msg.body, creds, settings?.embedding_service, settings?.embedding_model);
      if (embedding) {
        await messageRepo.updateMessageEmbedding(msg.id, embedding);
        logger.info('Backfilled embedding', { tenantId: tenant.id, messageId: msg.id });
      }
    }
  }
}
