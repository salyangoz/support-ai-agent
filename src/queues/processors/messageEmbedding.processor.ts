import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from '../queues';
import * as tenantRepo from '../../repositories/tenant.repository';
import * as messageRepo from '../../repositories/message.repository';
import { embed } from '../../services/embedding.service';
import { defaults } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Scanner: finds all messages without embeddings and enqueues a job for each.
 * Dedup: jobId per message prevents the same message from being queued twice.
 */
export async function scanMessageEmbeddings(job: Job): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.EMBED_MESSAGE);
  const tenants = await tenantRepo.findAllActiveTenants();
  let enqueued = 0;

  for (const tenant of tenants) {
    const messages = await messageRepo.findMessagesWithoutEmbedding(tenant.id);
    const settings = tenant.settings as any;
    const creds = settings?.embedding_credentials || settings?.ai_credentials;

    for (const msg of messages) {
      if (!msg.body) continue;

      await queue.add('embed-message', {
        messageId: msg.id,
        body: msg.body,
        credentials: creds,
        embeddingService: settings?.embedding_service || defaults.embeddingService,
        embeddingModel: settings?.embedding_model || defaults.embeddingModel,
      }, {
        jobId: `embed-msg-${msg.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      enqueued++;
    }
  }

  return enqueued;
}

/**
 * Worker: embeds one message.
 */
export async function processEmbedMessage(job: Job): Promise<void> {
  const { messageId, body, credentials, embeddingService, embeddingModel } = job.data;

  const embedding = await embed(body, credentials, embeddingService, embeddingModel);
  if (embedding) {
    await messageRepo.updateMessageEmbedding(messageId, embedding);
  }
}
