import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { getQueues } from './queues';

export function createQueueDashboard(): ExpressAdapter {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/queues');

  const queues = getQueues();
  const adapters = Array.from(queues.values()).map((q) => new BullMQAdapter(q));

  createBullBoard({
    queues: adapters,
    serverAdapter,
  });

  return serverAdapter;
}
