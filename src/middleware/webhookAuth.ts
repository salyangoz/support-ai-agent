import { Request, Response, NextFunction } from 'express';
import { findTenantById } from '../repositories/tenant.repository';
import { findAppById } from '../repositories/app.repository';
import { createInputApp } from '../apps/app.factory';
import { Tenant, App } from '../models/types';
import { InputApp } from '../apps/app.interface';

declare global {
  namespace Express {
    interface Request {
      tenantApp?: App;
      inputApp?: InputApp;
    }
  }
}

export async function webhookAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const tenantId = req.params.tenantId as string;
  const appIdParam = req.params.appId as string;

  try {
    const tenant = await findTenantById(tenantId) as Tenant | null;

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found' });
      return;
    }

    if (!tenant.isActive) {
      res.status(403).json({ error: 'Tenant is inactive' });
      return;
    }

    const appId = appIdParam;
    if (!appId) {
      res.status(400).json({ error: 'Invalid app ID' });
      return;
    }

    const app = await findAppById(tenant.id, appId) as App | null;

    if (!app) {
      res.status(400).json({
        error: 'App not configured for this tenant',
      });
      return;
    }

    if (!app.isActive) {
      res.status(400).json({ error: 'App is inactive' });
      return;
    }

    if (app.type !== 'ticket' || app.role === 'destination') {
      res.status(400).json({ error: 'App is not configured as an input source' });
      return;
    }

    const rawBody = req.body as Buffer;

    // Respond to ping events without signature verification
    try {
      const payload = JSON.parse(rawBody.toString());
      if (payload.topic === 'ping') {
        res.status(200).json({ message: 'pong' });
        return;
      }
    } catch { /* not JSON, continue with normal flow */ }

    const adapter = createInputApp(app);

    const isValid = adapter.verifyWebhook(rawBody, req.headers);

    if (!isValid) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    req.tenant = tenant;
    req.tenantApp = app;
    req.inputApp = adapter;
    next();
  } catch (error) {
    next(error);
  }
}
