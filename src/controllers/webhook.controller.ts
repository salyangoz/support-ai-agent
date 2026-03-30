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
    const tenantProvider = req.tenantProvider!;
    const providerAdapter = req.providerAdapter!;

    const rawBody = req.body as Buffer;
    const event = providerAdapter.parseWebhook(rawBody, req.headers);

    if (!event) {
      res.status(200).json({ message: 'Event ignored' });
      return;
    }

    res.status(200).json({ message: 'Webhook received' });

    setImmediate(() => {
      webhookHandlerService.handleEvent(tenant, tenantProvider, event).catch((err) => {
        logger.error('Webhook handler failed', {
          tenantId: tenant.id,
          provider: tenantProvider.provider,
          error: err.message,
        });
      });
    });
  } catch (err) {
    next(err);
  }
}
