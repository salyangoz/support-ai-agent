import { Request, Response, NextFunction } from 'express';
import * as webhookHandlerService from '../services/webhookHandler.service';
import { logger } from '../utils/logger';

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

    res.status(200).json({ message: 'Webhook received' });

    setImmediate(() => {
      webhookHandlerService.handleEvent(tenant, app, event).catch((err) => {
        logger.error('Webhook handler failed', {
          tenantId: tenant.id,
          appId: app.id,
          appCode: app.code,
          error: err.message,
        });
      });
    });
  } catch (err) {
    next(err);
  }
}
