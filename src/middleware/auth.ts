import { Request, Response, NextFunction } from 'express';
import { config } from '../config';
import { findTenantByApiKey } from '../repositories/tenant.repository';
import { Tenant } from '../models/types';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
    }
  }
}

export function adminAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey || apiKey !== config.adminApiKey) {
    res.status(401).json({ error: 'Invalid or missing API key' });
    return;
  }

  next();
}

export async function tenantAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    res.status(401).json({ error: 'Missing API key' });
    return;
  }

  try {
    const tenant = await findTenantByApiKey(apiKey) as Tenant | null;

    if (!tenant) {
      res.status(401).json({ error: 'Invalid API key' });
      return;
    }

    if (!tenant.isActive) {
      res.status(403).json({ error: 'Tenant is inactive' });
      return;
    }

    const tenantId = req.params.tenantId;
    if (tenantId && Number(tenantId) !== tenant.id) {
      res.status(403).json({
        error: 'API key does not match the specified tenant',
      });
      return;
    }

    req.tenant = tenant;
    next();
  } catch (error) {
    next(error);
  }
}
