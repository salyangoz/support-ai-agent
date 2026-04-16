import { Request, Response, NextFunction } from 'express';
import { getQueue, QUEUE_NAMES } from '../queues/queues';

export async function receive(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = req.tenant!;
    const app = req.tenantApp!;
    const inputApp = req.inputApp!;

    const rawBody = req.body as Buffer;
    const event = inputApp.parseWebhook(rawBody, req.headers);

    if (!event) {
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    await getQueue(QUEUE_NAMES.WEBHOOK_EVENT).add('webhook-event', {
      tenantId: tenant.id,
      appId: app.id,
      appCode: app.code,
      event,
    }, {
      jobId: `wh-${app.id}-${event.ticketExternalId}-${event.type}-${Date.now()}`,
      removeOnComplete: 100,
      removeOnFail: 200,
    });

    res.status(200).json({ message: 'Webhook received' });
  } catch (err) {
    next(err);
  }
}
