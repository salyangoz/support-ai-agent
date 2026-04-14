import { Worker } from 'bullmq';
import { logger } from './utils/logger';
import { getRedisConnection, closeRedisConnection } from './queues/connection';
import { QUEUE_NAMES } from './queues/queues';
import { registerRepeatableJobs } from './scheduler';

// Scanner processors (find work → fan out)
import { scanTicketSync, processSyncTenantApp } from './queues/processors/ticketSync.processor';
import { scanMessageEmbeddings, processEmbedMessage } from './queues/processors/messageEmbedding.processor';
import { scanArticleEmbeddings, processEmbedChunk } from './queues/processors/articleEmbedding.processor';
import { scanKbSync, processSyncKbApp } from './queues/processors/kbSync.processor';

const workers: Worker[] = [];

async function main(): Promise<void> {
  try {
    const connection = getRedisConnection();

    // Register repeatable scanner schedules
    await registerRepeatableJobs();

    // Scanner workers (concurrency 1 — only one scan at a time)
    workers.push(
      new Worker(QUEUE_NAMES.SCAN_TICKET_SYNC, scanTicketSync, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_MESSAGE_EMBEDDINGS, scanMessageEmbeddings, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_ARTICLE_EMBEDDINGS, scanArticleEmbeddings, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_KB_SYNC, scanKbSync, { connection, concurrency: 1 }),
    );

    // Granular workers (higher concurrency — process items in parallel)
    workers.push(
      new Worker(QUEUE_NAMES.SYNC_TENANT_APP, processSyncTenantApp, { connection, concurrency: 3 }),
      new Worker(QUEUE_NAMES.EMBED_MESSAGE, processEmbedMessage, { connection, concurrency: 5 }),
      new Worker(QUEUE_NAMES.EMBED_CHUNK, processEmbedChunk, { connection, concurrency: 5 }),
      new Worker(QUEUE_NAMES.SYNC_KB_APP, processSyncKbApp, { connection, concurrency: 3 }),
    );

    // Logging for all workers
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
      });
    }

    logger.info(`Worker process running — ${workers.length} queue consumers active`);

    // Graceful shutdown
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
