import { Request, Response, NextFunction } from 'express';
import * as ticketService from '../services/ticket.service';
import * as ticketSyncService from '../services/ticketSync.service';
import * as appService from '../services/app.service';
import * as ticketRepo from '../repositories/ticket.repository';
import { toSnakeCase } from '../utils/serializer';
import { parsePaginationQuery } from '../utils/pagination';
import { logger } from '../utils/logger';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { input_app_id, state, customer_id, page } = req.query;
    const pagination = parsePaginationQuery(req.query as Record<string, unknown>);

    const result = await ticketService.getTickets(tenantId, {
      inputAppId: input_app_id as string | undefined,
      state: state as string | undefined,
      customerId: customer_id as string | undefined,
      cursor: pagination.cursor,
      limit: pagination.limit,
      page: !pagination.cursor && page ? Number(page) : undefined,
    });

    res.status(200).json(toSnakeCase(result));
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
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;

    const result = await ticketService.getTicketWithMessages(tenantId, id);

    if (!result) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.status(200).json(toSnakeCase(result));
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
    const tenantId = req.params.tenantId as string;
    const { app_id } = req.body;

    if (!app_id) {
      res.status(400).json({ error: 'app_id is required' });
      return;
    }

    const tenant = req.tenant!;
    const app = await appService.getApp(tenantId, app_id);

    if (!app) {
      res.status(404).json({
        error: 'App not configured for this tenant',
      });
      return;
    }

    res.status(200).json({ message: 'Sync started' });

    setImmediate(() => {
      ticketSyncService
        .syncInputApp(tenant as any, app as any)
        .catch((err: any) => {
          logger.error('Background sync failed', {
            tenantId,
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

export async function updateOutputApp(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const ticketId = req.params.id as string;
    const { output_app_id } = req.body;

    if (!output_app_id) {
      res.status(400).json({ error: 'output_app_id is required' });
      return;
    }

    const app = await appService.getApp(tenantId, output_app_id);
    if (!app) {
      res.status(404).json({ error: 'Output app not found' });
      return;
    }

    if (app.role === 'source') {
      res.status(400).json({ error: 'App is not configured as a destination' });
      return;
    }

    const ticket = await ticketRepo.updateTicketOutputApp(tenantId, ticketId, output_app_id);
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    res.status(200).json(toSnakeCase(ticket));
  } catch (err) {
    next(err);
  }
}
