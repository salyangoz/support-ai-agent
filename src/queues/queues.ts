import { Queue } from 'bullmq';
import { getRedisConnection } from './connection';

export const QUEUE_NAMES = {
  // Scanner jobs (repeatable) — find work and fan out
  SCAN_TICKET_SYNC: 'scan-ticket-sync',
  SCAN_MESSAGE_EMBEDDINGS: 'scan-message-embeddings',
  SCAN_ARTICLE_EMBEDDINGS: 'scan-article-embeddings',

  // Granular jobs — one unit of work each
  SYNC_TENANT_APP: 'sync-tenant-app',
  EMBED_MESSAGE: 'embed-message',
  EMBED_CHUNK: 'embed-chunk',
  SCAN_KB_SYNC: 'scan-kb-sync',
  SYNC_KB_APP: 'sync-kb-app',
} as const;

let queues: Map<string, Queue> | null = null;

export function getQueues(): Map<string, Queue> {
  if (!queues) {
    const connection = getRedisConnection();
    queues = new Map();

    for (const name of Object.values(QUEUE_NAMES)) {
      queues.set(name, new Queue(name, { connection }));
    }
  }
  return queues;
}

export function getQueue(name: string): Queue {
  const q = getQueues().get(name);
  if (!q) throw new Error(`Queue "${name}" not found`);
  return q;
}

export async function closeQueues(): Promise<void> {
  if (queues) {
    for (const q of queues.values()) {
      await q.close();
    }
    queues = null;
  }
}
