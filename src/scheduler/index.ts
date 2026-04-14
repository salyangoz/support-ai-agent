import { getQueue, QUEUE_NAMES } from '../queues/queues';
import { logger } from '../utils/logger';

const SCAN_INTERVAL = 10 * 60 * 1000; // 10 minutes

/**
 * Registers repeatable scanner jobs in BullMQ.
 * All scanners run every 10 minutes.
 * If a previous scan is still active, BullMQ skips the new one (jobId dedup).
 */
export async function registerRepeatableJobs(): Promise<void> {
  const scanners = [
    QUEUE_NAMES.SCAN_TICKET_SYNC,
    QUEUE_NAMES.SCAN_MESSAGE_EMBEDDINGS,
    QUEUE_NAMES.SCAN_ARTICLE_EMBEDDINGS,
    QUEUE_NAMES.SCAN_KB_SYNC,
  ];

  for (const name of scanners) {
    await getQueue(name).upsertJobScheduler(
      `${name}-repeat`,
      { every: SCAN_INTERVAL },
      { name },
    );
  }

  logger.info('Repeatable scanner jobs registered (every 10 min)');
}
