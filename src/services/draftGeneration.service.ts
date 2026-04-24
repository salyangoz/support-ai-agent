import { defaults } from '../config';
import { getQueue, QUEUE_NAMES } from '../queues/queues';
import { Tenant, TenantSettings } from '../models/types';
import { generateDraft, sendDraft } from './aiDraft.service';
import * as draftRepo from '../repositories/draft.repository';
import * as messageRepo from '../repositories/message.repository';
import * as tenantRepo from '../repositories/tenant.repository';
import { logger } from '../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

function getDraftDebounceSeconds(tenant: Tenant): number {
  const value = Number(getSetting(tenant, 'draft_debounce_seconds', defaults.draftDebounceSeconds));
  if (!Number.isFinite(value) || value < 0) {
    return defaults.draftDebounceSeconds;
  }
  return Math.floor(value);
}

export async function enqueueDraftGeneration(
  tenant: Tenant,
  ticketId: string,
  triggerSource: 'webhook' | 'polling',
): Promise<void> {
  const delayMs = getDraftDebounceSeconds(tenant) * 1000;
  const queue = getQueue(QUEUE_NAMES.DRAFT_GENERATION);
  const jobId = `draft-${tenant.id}-${ticketId}`;
  const existing = await queue.getJob(jobId);
  if (existing) {
    await existing.remove().catch(() => {});
  }

  await queue.add(
    'draft-generation',
    {
      tenantId: tenant.id,
      ticketId,
      triggerSource,
      enqueuedAt: new Date().toISOString(),
    },
    {
      jobId,
      delay: delayMs,
      removeOnComplete: 100,
      removeOnFail: 200,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    },
  );
}

export async function processDraftGenerationJob(data: { tenantId: string; ticketId: string }): Promise<void> {
  const tenant = await tenantRepo.findTenantById(data.tenantId) as Tenant | null;
  if (!tenant) {
    logger.warn('Draft generation skipped: tenant not found', { tenantId: data.tenantId });
    return;
  }

  const messages = await messageRepo.findMessagesByTicketId(data.ticketId, data.tenantId);
  if (messages.length === 0) {
    return;
  }

  const latestMessage = messages[messages.length - 1];
  if (!latestMessage || latestMessage.authorRole !== 'customer') {
    return;
  }

  const latestCustomerMessage = [...messages].reverse().find((m) => m.authorRole === 'customer');
  if (!latestCustomerMessage?.createdAt) {
    return;
  }

  const debounceMs = getDraftDebounceSeconds(tenant) * 1000;
  const quietForMs = Date.now() - latestCustomerMessage.createdAt.getTime();
  if (quietForMs < debounceMs) {
    await enqueueDraftGeneration(tenant, data.ticketId, 'webhook');
    return;
  }

  const existingDrafts = await draftRepo.findDraftsByTicketId(data.tenantId, data.ticketId, { limit: 1 });
  const latestDraft = existingDrafts.data[0];
  const shouldGenerate = !latestDraft || latestDraft.createdAt < latestCustomerMessage.createdAt;

  if (!shouldGenerate) {
    return;
  }

  const draft = await generateDraft(tenant, data.ticketId);
  const autoSend = getSetting(tenant, 'auto_send_drafts', defaults.autoSendDrafts);
  if (autoSend && draft) {
    await sendDraft(tenant, draft.id);
  }
}
