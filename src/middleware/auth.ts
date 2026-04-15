import { Request, Response, NextFunction } from 'express';
import { findTenantByApiKey, findTenantById } from '../repositories/tenant.repository';
import { findUserById } from '../repositories/user.repository';
import { findTenantUser } from '../repositories/tenantUser.repository';
import { verifyAccessToken } from '../services/auth.service';
import { Tenant, User, TenantUser, UserRole } from '../models/types';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      user?: User;
      tenantUser?: TenantUser;
    }
  }
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
    if (tenantId && tenantId !== tenant.id) {
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

export async function userAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    const user = await findUserById(payload.userId) as User | null;

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    req.user = user;

    const tenantId = req.params.tenantId as string | undefined;
    if (tenantId) {
      const tenantUser = await findTenantUser(tenantId, user.id) as TenantUser | null;

      if (!tenantUser || !tenantUser.isActive) {
        res.status(403).json({ error: 'Access denied to this tenant' });
        return;
      }

      const tenant = await findTenantById(tenantId) as Tenant | null;
      if (!tenant || !tenant.isActive) {
        res.status(403).json({ error: 'Tenant is inactive' });
        return;
      }

      req.tenant = tenant;
      req.tenantUser = tenantUser;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.tenantUser) {
      next();
      return;
    }

    if (!roles.includes(req.tenantUser.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export async function tenantOrUserAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  const authHeader = req.headers.authorization;

  if (apiKey) {
    return tenantAuth(req, res, next);
  }

  if (authHeader && authHeader.startsWith('Bearer ')) {
    return userAuth(req, res, next);
  }

  res.status(401).json({ error: 'Missing authentication' });
}
