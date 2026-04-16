import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import * as userService from '../services/user.service';
import { findTenantUsersByUserId } from '../repositories/tenantUser.repository';
import { toSnakeCase } from '../utils/serializer';

function stripPassword(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      res.status(400).json({ error: 'email, password and name are required' });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    const result = await authService.register({ email, password, name });

    res.status(201).json(toSnakeCase({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: stripPassword(result.user),
    }));
  } catch (err) {
    next(err);
  }
}

export async function login(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'email and password are required' });
      return;
    }

    const result = await authService.login(email, password);

    res.status(200).json(toSnakeCase({
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
      user: stripPassword(result.user),
      tenants: result.tenants,
    }));
  } catch (err) {
    next(err);
  }
}

export async function refresh(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      res.status(400).json({ error: 'refresh_token is required' });
      return;
    }

    const tokens = await authService.refreshTokens(refresh_token);

    res.status(200).json(toSnakeCase({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }));
  } catch (err) {
    next(err);
  }
}

export async function me(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;

    const tenantUsers = await findTenantUsersByUserId(user.id);
    const tenants = tenantUsers.map((tu: any) => ({
      id: tu.tenant.id,
      name: tu.tenant.name,
      slug: tu.tenant.slug,
      role: tu.role,
    }));

    res.status(200).json(toSnakeCase({
      ...stripPassword(user),
      tenants,
    }));
  } catch (err) {
    next(err);
  }
}

export async function changePassword(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = req.user!;
    const { old_password, new_password } = req.body;

    if (!old_password || !new_password) {
      res.status(400).json({ error: 'old_password and new_password are required' });
      return;
    }

    if (new_password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' });
      return;
    }

    await userService.changePassword(user.id, old_password, new_password);

    res.status(200).json({ message: 'Password changed successfully' });
  } catch (err) {
    next(err);
  }
}
