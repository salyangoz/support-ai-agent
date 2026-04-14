import { Request, Response, NextFunction } from 'express';
import * as appService from '../services/app.service';
import { testAppCredentials } from '../services/appTest.service';
import { toSnakeCase } from '../utils/serializer';

const VALID_TYPES = ['ticket', 'knowledge', 'notification'];
const VALID_ROLES = ['source', 'destination', 'both'];

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const filters: { type?: string; role?: string; code?: string; isActive?: boolean } = {};
    if (req.query.type) filters.type = req.query.type as string;
    if (req.query.role) filters.role = req.query.role as string;
    if (req.query.code) filters.code = req.query.code as string;
    if (req.query.is_active !== undefined) filters.isActive = req.query.is_active === 'true';

    const apps = await appService.getApps(tenantId, filters);
    res.status(200).json(toSnakeCase(apps));
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
    const appId = req.params.appId as string;
    const app = await appService.getApp(tenantId, appId);
    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }
    res.status(200).json(toSnakeCase(app));
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
    const tenantId = req.params.tenantId as string;
    const { code, type, role, name, credentials, webhook_secret, config } = req.body;

    if (!code || !type || !role || !credentials) {
      res.status(400).json({
        error: 'code, type, role, and credentials are required',
      });
      return;
    }

    if (!VALID_TYPES.includes(type)) {
      res.status(400).json({
        error: `type must be one of: ${VALID_TYPES.join(', ')}`,
      });
      return;
    }

    if (!VALID_ROLES.includes(role)) {
      res.status(400).json({
        error: `role must be one of: ${VALID_ROLES.join(', ')}`,
      });
      return;
    }

    const app = await appService.addApp({
      tenantId,
      code,
      type,
      role,
      name,
      credentials,
      webhookSecret: webhook_secret,
      config,
    });

    res.status(201).json(toSnakeCase(app));
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
    const tenantId = req.params.tenantId as string;
    const appId = req.params.appId as string;
    const { name, credentials, webhook_secret, config, is_active, role } = req.body;

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      res.status(400).json({
        error: `role must be one of: ${VALID_ROLES.join(', ')}`,
      });
      return;
    }

    const app = await appService.updateApp(tenantId, appId, {
      name,
      credentials,
      webhookSecret: webhook_secret,
      config,
      isActive: is_active,
      role,
    });

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    res.status(200).json(toSnakeCase(app));
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
    const tenantId = req.params.tenantId as string;
    const appId = req.params.appId as string;
    await appService.removeApp(tenantId, appId);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

export async function test(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const appId = req.params.appId as string;
    const app = await appService.getApp(tenantId, appId);

    if (!app) {
      res.status(404).json({ error: 'App not found' });
      return;
    }

    const result = await testAppCredentials(app as any);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}
