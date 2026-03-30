import { Request, Response, NextFunction } from 'express';
import * as tenantProviderService from '../services/tenantProvider.service';

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const providers = await tenantProviderService.getProviders(tenantId);
    res.status(200).json(providers);
  } catch (err) {
    next(err);
  }
}

export async function create(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const { provider, credentials, webhook_secret } = req.body;

    if (!provider || !credentials) {
      res.status(400).json({ error: 'provider and credentials are required' });
      return;
    }

    const tenantProvider = await tenantProviderService.addProvider({
      tenantId,
      provider,
      credentials,
      webhookSecret: webhook_secret,
    });

    res.status(201).json(tenantProvider);
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
    const tenantId = Number(req.params.tenantId);
    const { provider } = req.params;
    const { credentials, webhook_secret, is_active } = req.body;

    const tenantProvider = await tenantProviderService.updateProvider(tenantId, provider as string, {
      credentials,
      webhookSecret: webhook_secret,
      isActive: is_active,
    });

    if (!tenantProvider) {
      res.status(404).json({ error: 'Provider not found' });
      return;
    }

    res.status(200).json(tenantProvider);
  } catch (err) {
    next(err);
  }
}

export async function remove(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = Number(req.params.tenantId);
    const { provider } = req.params;
    await tenantProviderService.removeProvider(tenantId, provider as string);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
