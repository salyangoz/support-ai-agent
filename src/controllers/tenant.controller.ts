import { Request, Response, NextFunction } from 'express';
import * as tenantService from '../services/tenant.service';

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, slug, settings } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'name and slug are required' });
      return;
    }

    const tenant = await tenantService.createTenant({ name, slug, settings });
    res.status(201).json(tenant);
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
    const tenant = await tenantService.getTenantById(Number(req.params.tenantId));

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.status(200).json(tenant);
  } catch (err) {
    next(err);
  }
}

export async function update(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, settings } = req.body;
    const tenant = await tenantService.updateTenant(Number(req.params.tenantId), { name, settings });

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.status(200).json(tenant);
  } catch (err) {
    next(err);
  }
}
