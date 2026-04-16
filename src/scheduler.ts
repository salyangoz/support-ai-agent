import { initSentry, Sentry } from './utils/sentry';
initSentry();

import { Worker } from 'bullmq';
import { logger } from './utils/logger';
import { getRedisConnection, closeRedisConnection } from './queues/connection';
import { getQueue, QUEUE_NAMES } from './queues/queues';
import { runMigrations } from './database/migrate';

import { scanTicketSync } from './queues/processors/ticketSync.processor';
import { scanMessageEmbeddings } from './queues/processors/messageEmbedding.processor';
import { scanArticleEmbeddings } from './queues/processors/articleEmbedding.processor';
import { scanKbSync } from './queues/processors/kbSync.processor';

const SCAN_INTERVAL = 10 * 60 * 1000;

const SCANNER_QUEUES = [
  QUEUE_NAMES.SCAN_TICKET_SYNC,
  QUEUE_NAMES.SCAN_MESSAGE_EMBEDDINGS,
  QUEUE_NAMES.SCAN_ARTICLE_EMBEDDINGS,
  QUEUE_NAMES.SCAN_KB_SYNC,
];

async function registerRepeatableJobs(): Promise<void> {
  for (const name of SCANNER_QUEUES) {
    await getQueue(name).upsertJobScheduler(
      `${name}-repeat`,
      { every: SCAN_INTERVAL },
      { name },
    );
  }
  logger.info('Repeatable scanner jobs registered (every 10 min)');
}

const workers: Worker[] = [];

async function main(): Promise<void> {
  try {
    await runMigrations();

    const connection = getRedisConnection();

    await registerRepeatableJobs();

    workers.push(
      new Worker(QUEUE_NAMES.SCAN_TICKET_SYNC, scanTicketSync, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_MESSAGE_EMBEDDINGS, scanMessageEmbeddings, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_ARTICLE_EMBEDDINGS, scanArticleEmbeddings, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_KB_SYNC, scanKbSync, { connection, concurrency: 1 }),
    );

    for (const w of workers) {
      w.on('completed', (job) => {
        logger.info(`Scanner completed: ${job.name}`, {
          queue: w.name,
          jobId: job.id,
          duration: job.finishedOn && job.processedOn
            ? job.finishedOn - job.processedOn
            : null,
        });
      });

      w.on('failed', (job, err) => {
        logger.error(`Scanner failed: ${job?.name}`, {
          queue: w.name,
          jobId: job?.id,
          error: err.message,
          attempt: job?.attemptsMade,
        });
        Sentry.captureException(err, {
          tags: { queue: w.name, jobName: job?.name, process: 'scheduler' },
          extra: { jobId: job?.id, jobData: job?.data },
        });
      });
    }

    logger.info(`Scheduler process running — ${workers.length} scanner consumers active`);

    const shutdown = async () => {
      logger.info('Shutting down scheduler...');
      await Promise.all(workers.map((w) => w.close()));
      await closeRedisConnection();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('Failed to start scheduler', err);
    process.exit(1);
  }
}

main();
