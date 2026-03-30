import { Request, Response, NextFunction } from 'express';
import * as aiDraftService from '../services/aiDraft.service';
import * as draftService from '../services/draft.service';
import { toSnakeCase } from '../utils/serializer';

export async function generate(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenant = req.tenant!;
    const ticketId = Number(req.params.id);

    const draft = await aiDraftService.generateDraft(tenant, ticketId);
    res.status(201).json(toSnakeCase(draft));
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
    const tenantId = Number(req.params.tenantId);
    const ticketId = Number(req.params.id);

    const drafts = await draftService.getDraftsByTicketId(
      tenantId,
      ticketId,
    );
    res.status(200).json(toSnakeCase(drafts));
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
    const tenantId = Number(req.params.tenantId);
    const draftId = Number(req.params.id);
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
    const tenantId = Number(req.params.tenantId);
    const draftId = Number(req.params.id);

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
