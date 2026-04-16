import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from '../queues';
import * as tenantRepo from '../../repositories/tenant.repository';
import * as chunkRepo from '../../repositories/knowledgeChunk.repository';
import { embed } from '../../services/embedding.service';
import { defaults } from '../../config';
import { logger } from '../../utils/logger';

/**
 * Scanner: finds all KB chunks without embeddings and enqueues a job for each.
 * Dedup: jobId per chunk prevents the same chunk from being queued twice.
 */
export async function scanArticleEmbeddings(job: Job): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.EMBED_CHUNK);
  const tenants = await tenantRepo.findAllActiveTenants();
  let enqueued = 0;

  for (const tenant of tenants) {
    const chunks = await chunkRepo.findChunksWithoutEmbedding(tenant.id);
    const settings = tenant.settings as any;
    const creds = settings?.embedding_credentials || settings?.ai_credentials;

    for (const chunk of chunks) {
      await queue.add('embed-chunk', {
        chunkId: chunk.id,
        text: chunk.content,
        credentials: creds,
        embeddingService: settings?.embedding_service || defaults.embeddingService,
        embeddingModel: settings?.embedding_model || defaults.embeddingModel,
      }, {
        jobId: `embed-chunk-${chunk.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      enqueued++;
    }
  }

  return enqueued;
}

/**
 * Worker: embeds one KB chunk.
 */
export async function processEmbedChunk(job: Job): Promise<void> {
  const { chunkId, text, credentials, embeddingService, embeddingModel } = job.data;

  const embedding = await embed(text, credentials, embeddingService, embeddingModel);
  if (embedding) {
    await chunkRepo.updateChunkEmbedding(chunkId, embedding);
  }
}
