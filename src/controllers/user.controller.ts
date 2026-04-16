import { Request, Response, NextFunction } from 'express';
import * as userService from '../services/user.service';
import { UserRole } from '../models/types';
import { toSnakeCase } from '../utils/serializer';

function stripPassword(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(stripPassword);
  }
  if (obj && typeof obj === 'object') {
    const { passwordHash, ...rest } = obj;
    if (rest.user) {
      rest.user = stripPassword(rest.user);
    }
    return rest;
  }
  return obj;
}

const VALID_ROLES: UserRole[] = ['owner', 'admin', 'member'];

export async function list(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const members = await userService.listTenantMembers(tenantId);
    res.status(200).json({ data: toSnakeCase(stripPassword(members)) });
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
    const userId = req.params.userId as string;
    const member = await userService.getTenantMember(tenantId, userId);

    if (!member) {
      res.status(404).json({ error: 'User not found in this tenant' });
      return;
    }

    res.status(200).json(toSnakeCase(stripPassword(member)));
  } catch (err) {
    next(err);
  }
}

export async function invite(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const { email, password, name, role } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password, and name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const userRole = (role || 'member') as UserRole;
    if (!VALID_ROLES.includes(userRole)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    if (userRole === 'owner' && req.tenantUser?.role !== 'owner') {
      res.status(403).json({ error: 'Only the owner can create another owner' });
      return;
    }

    const result = await userService.inviteUser(tenantId, {
      email,
      password,
      name,
      role: userRole,
    });

    res.status(201).json(toSnakeCase(stripPassword(result)));
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
    const userId = req.params.userId as string;
    const { role, is_active } = req.body;

    if (role !== undefined && !VALID_ROLES.includes(role)) {
      res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });
      return;
    }

    if (role === 'owner' && req.tenantUser?.role !== 'owner') {
      res.status(403).json({ error: 'Only the owner can promote to owner' });
      return;
    }

    const result = await userService.updateMembership(tenantId, userId, {
      role,
      isActive: is_active,
    });

    if (!result) {
      res.status(404).json({ error: 'User not found in this tenant' });
      return;
    }

    res.status(200).json(toSnakeCase(result));
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
    const userId = req.params.userId as string;

    const result = await userService.removeMembership(tenantId, userId);

    if (!result) {
      res.status(404).json({ error: 'User not found in this tenant' });
      return;
    }

    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

