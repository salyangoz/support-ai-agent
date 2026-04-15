import { Request, Response, NextFunction } from 'express';
import * as aiDraftService from '../services/aiDraft.service';
import * as draftService from '../services/draft.service';
import { toSnakeCase } from '../utils/serializer';
import { parsePaginationQuery } from '../utils/pagination';

export async function generate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = req.tenant!;
    const ticketId = req.params.id as string;

    const draft = await aiDraftService.generateDraft(tenant, ticketId);
    res.status(201).json(toSnakeCase(draft));
  } catch (err) {
    next(err);
  }
}

export async function listByTenant(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const status = req.query.status as string | undefined;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
    const pagination = parsePaginationQuery(req.query as Record<string, unknown>);

    const result = await draftService.getDraftsByTenantId(tenantId, {
      status,
      cursor: pagination.cursor,
      limit: pagination.limit,
      offset: !pagination.cursor ? offset : undefined,
    });
    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}

export async function listByTicket(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const ticketId = req.params.id as string;
    const pagination = parsePaginationQuery(req.query as Record<string, unknown>);

    const result = await draftService.getDraftsByTicketId(
      tenantId,
      ticketId,
      { cursor: pagination.cursor, limit: pagination.limit },
    );
    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const draftId = req.params.id as string;
    const { status, reviewed_by } = req.body;

    if (!status || !['approved', 'rejected'].includes(status)) {
      res.status(400).json({
        error: 'status must be "approved" or "rejected"',
      });
      return;
    }

    const draft = await draftService.updateDraftStatus(
      tenantId,
      draftId,
      status,
      reviewed_by,
    );

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    res.status(200).json(toSnakeCase(draft));
  } catch (err) {
    next(err);
  }
}

export async function send(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = req.tenant!;
    const tenantId = req.params.tenantId as string;
    const draftId = req.params.id as string;

    const draft = await draftService.getDraftById(tenantId, draftId);

    if (!draft) {
      res.status(404).json({ error: 'Draft not found' });
      return;
    }

    if (draft.status !== 'approved') {
      res.status(400).json({
        error: 'Draft must be approved before sending',
      });
      return;
    }

    const result = await aiDraftService.sendDraft(tenant, draftId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
