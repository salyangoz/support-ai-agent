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
import { scanVoiceSync } from './queues/processors/voiceSync.processor';
import { scanVoiceTranscription } from './queues/processors/voiceTranscription.processor';

const DEFAULT_SCAN_INTERVAL_MS = 10 * 60 * 1000;

const SCANNER_SCHEDULE: Array<{ queue: string; intervalMs: number }> = [
  { queue: QUEUE_NAMES.SCAN_TICKET_SYNC, intervalMs: DEFAULT_SCAN_INTERVAL_MS },
  { queue: QUEUE_NAMES.SCAN_MESSAGE_EMBEDDINGS, intervalMs: DEFAULT_SCAN_INTERVAL_MS },
  { queue: QUEUE_NAMES.SCAN_ARTICLE_EMBEDDINGS, intervalMs: DEFAULT_SCAN_INTERVAL_MS },
  { queue: QUEUE_NAMES.SCAN_KB_SYNC, intervalMs: DEFAULT_SCAN_INTERVAL_MS },
  { queue: QUEUE_NAMES.SCAN_VOICE_SYNC, intervalMs: DEFAULT_SCAN_INTERVAL_MS },
  { queue: QUEUE_NAMES.SCAN_VOICE_TRANSCRIPTION, intervalMs: 2 * 60 * 1000 },
];

async function registerRepeatableJobs(): Promise<void> {
  for (const { queue, intervalMs } of SCANNER_SCHEDULE) {
    await getQueue(queue).upsertJobScheduler(
      `${queue}-repeat`,
      { every: intervalMs },
      { name: queue },
    );
  }
  logger.info('Repeatable scanner jobs registered', {
    schedules: SCANNER_SCHEDULE.map((s) => `${s.queue}:${Math.round(s.intervalMs / 1000)}s`),
  });
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
      new Worker(QUEUE_NAMES.SCAN_VOICE_SYNC, scanVoiceSync, { connection, concurrency: 1 }),
      new Worker(QUEUE_NAMES.SCAN_VOICE_TRANSCRIPTION, scanVoiceTranscription, { connection, concurrency: 1 }),
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
