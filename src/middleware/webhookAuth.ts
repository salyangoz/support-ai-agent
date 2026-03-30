import { Request, Response, NextFunction } from 'express';
import { findTenantBySlug } from '../repositories/tenant.repository';
import { findProvider } from '../repositories/tenantProvider.repository';
import { createProvider } from '../providers/provider.factory';
import { Tenant, TenantProvider } from '../models/types';
import { TicketProvider } from '../providers/provider.interface';

declare global {
  namespace Express {
    interface Request {
      tenantProvider?: TenantProvider;
      providerAdapter?: TicketProvider;
    }
  }
}

export async function webhookAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantSlug = req.params.tenantSlug as string;
  const provider = req.params.provider as string;

  try {
    const tenant = await findTenantBySlug(tenantSlug) as Tenant | null;

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    if (!tenant.isActive) {
      res.status(403).json({ error: 'Tenant is inactive' });
      return;
    }

    const tenantProvider = await findProvider(
      tenant.id,
      provider,
    ) as TenantProvider | null;

    if (!tenantProvider) {
      res.status(400).json({
        error: 'Provider not configured for this tenant',
      });
      return;
    }

    if (!tenantProvider.isActive) {
      res.status(400).json({ error: 'Provider is inactive' });
      return;
    }

    const credentials = tenantProvider.credentials as Record<string, any>;
    const adapter = createProvider({ ...credentials, provider });
    const rawBody = req.body as Buffer;

    const isValid = adapter.verifyWebhook(rawBody, req.headers);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    req.tenant = tenant;
    req.tenantProvider = tenantProvider;
    req.providerAdapter = adapter;
    next();
  } catch (error) {
    next(error);
  }
}
