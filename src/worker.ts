import { initSentry, Sentry } from './utils/sentry';
initSentry();

import { Worker } from 'bullmq';
import { logger } from './utils/logger';
import { getRedisConnection, closeRedisConnection } from './queues/connection';
import { QUEUE_NAMES } from './queues/queues';
import { runMigrations } from './database/migrate';

// Granular processors (one unit of work per job)
import { processSyncTenantApp } from './queues/processors/ticketSync.processor';
import { processEmbedMessage } from './queues/processors/messageEmbedding.processor';
import { processEmbedChunk } from './queues/processors/articleEmbedding.processor';
import { processSyncKbApp } from './queues/processors/kbSync.processor';
import { processGenerateKbFromTicket } from './queues/processors/ticketKb.processor';
import { processWebhookEvent } from './queues/processors/webhookEvent.processor';

const workers: Worker[] = [];

async function main(): Promise<void> {
  try {
    await runMigrations();

    const connection = getRedisConnection();

    workers.push(
      new Worker(QUEUE_NAMES.SYNC_TENANT_APP, processSyncTenantApp, { connection, concurrency: 3 }),
      new Worker(QUEUE_NAMES.EMBED_MESSAGE, processEmbedMessage, { connection, concurrency: 5 }),
      new Worker(QUEUE_NAMES.EMBED_CHUNK, processEmbedChunk, { connection, concurrency: 5 }),
      new Worker(QUEUE_NAMES.SYNC_KB_APP, processSyncKbApp, { connection, concurrency: 3 }),
      new Worker(QUEUE_NAMES.GENERATE_KB_FROM_TICKET, processGenerateKbFromTicket, { connection, concurrency: 3 }),
      new Worker(QUEUE_NAMES.WEBHOOK_EVENT, processWebhookEvent, { connection, concurrency: 5 }),
    );

    for (const w of workers) {
      w.on('completed', (job) => {
        logger.info(`Job completed: ${job.name}`, {
          queue: w.name,
          jobId: job.id,
          result: job.returnvalue,
          duration: job.finishedOn && job.processedOn
            ? job.finishedOn - job.processedOn
            : null,
        });
      });

      w.on('failed', (job, err) => {
        logger.error(`Job failed: ${job?.name}`, {
          queue: w.name,
          jobId: job?.id,
          error: err.message,
          attempt: job?.attemptsMade,
        });
        Sentry.captureException(err, {
          tags: { queue: w.name, jobName: job?.name },
          extra: { jobId: job?.id, jobData: job?.data },
        });
      });
    }

    logger.info(`Worker process running — ${workers.length} queue consumers active`);

    const shutdown = async () => {
      logger.info('Shutting down workers...');
      await Promise.all(workers.map((w) => w.close()));
      await closeRedisConnection();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('Failed to start worker', err);
    process.exit(1);
  }
}

main();
