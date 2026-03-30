import { Request, Response, NextFunction } from 'express';
import * as ticketService from '../services/ticket.service';
import * as ticketSyncService from '../services/ticketSync.service';
import * as tenantProviderService from '../services/tenantProvider.service';
import { logger } from '../utils/logger';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const { provider, state, customer_id, page, limit } = req.query;

    const tickets = await ticketService.getTickets(tenantId, {
      provider: provider as string | undefined,
      state: state as string | undefined,
      customerId: customer_id ? Number(customer_id) : undefined,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });

    res.status(200).json({ data: tickets });
  } catch (err) {
    next(err);
  }
}

export async function show(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const id = Number(req.params.id);

    const result = await ticketService.getTicketWithMessages(tenantId, id);

    if (!result) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function sync(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const { provider } = req.body;

    if (!provider) {
      res.status(400).json({ error: 'provider is required' });
      return;
    }

    const tenant = req.tenant!;
    const providerConfig = await tenantProviderService.getProvider(tenantId, provider);

    if (!providerConfig) {
      res.status(404).json({ error: 'Provider not configured for this tenant' });
      return;
    }

    res.status(200).json({ message: 'Sync started' });

    setImmediate(() => {
      ticketSyncService.syncTenantProvider(tenant, providerConfig).catch((err) => {
        logger.error('Background sync failed', { tenantId, provider, error: err.message });
      });
    });
  } catch (err) {
    next(err);
  }
}
