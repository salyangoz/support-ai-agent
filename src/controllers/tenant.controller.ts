import { Request, Response, NextFunction } from 'express';
import * as tenantService from '../services/tenant.service';
import { toSnakeCase } from '../utils/serializer';

export async function createForUser(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, slug } = req.body;

    if (!name || !slug) {
      res.status(400).json({ error: 'name and slug are required' });
      return;
    }

    const result = await tenantService.createTenantWithOwner(req.user!.id, { name, slug });

    res.status(201).json(toSnakeCase({
      ...result.tenant,
      tenantUser: result.tenantUser,
    }));
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
    const tenant = await tenantService.getTenantById(req.params.tenantId as string);

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.status(200).json(toSnakeCase(tenant));
  } catch (err) {
    next(err);
  }
}

export async function updateForOwner(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, settings } = req.body;

    if (name === undefined && settings === undefined) {
      res.status(400).json({ error: 'At least one of name or settings is required' });
      return;
    }

    const tenant = await tenantService.partialUpdateTenant(
      req.params.tenantId as string,
      { name, settings },
    );

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    res.status(200).json(toSnakeCase(tenant));
  } catch (err) {
    next(err);
  }
}
