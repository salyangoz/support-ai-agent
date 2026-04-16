import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { findUserById, findUserByEmail, createUser, updateLastLogin } from '../repositories/user.repository';
import { findTenantUsersByUserId } from '../repositories/tenantUser.repository';
import { User } from '../models/types';

const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

interface TokenPayload {
  userId: string;
  type: 'access' | 'refresh';
}

export function generateTokens(user: User): {
  accessToken: string;
  refreshToken: string;
} {
  const accessToken = jwt.sign(
    { userId: user.id, type: 'access' } as TokenPayload,
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions,
  );

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' } as TokenPayload,
    config.jwtSecret,
    { expiresIn: config.jwtRefreshExpiresIn } as jwt.SignOptions,
  );

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  if (payload.type !== 'access') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export function verifyRefreshToken(token: string): TokenPayload {
  const payload = jwt.verify(token, config.jwtSecret) as TokenPayload;
  if (payload.type !== 'refresh') {
    throw new Error('Invalid token type');
  }
  return payload;
}

export async function login(email: string, password: string) {
  const user = (await findUserByEmail(email)) as User | null;

  if (!user) {
    throw Object.assign(new Error('Invalid email or password'), {
      statusCode: 401,
    });
  }

  if (!user.isActive) {
    throw Object.assign(new Error('Account is inactive'), {
      statusCode: 403,
    });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid email or password'), {
      statusCode: 401,
    });
  }

  await updateLastLogin(user.id);

  const tokens = generateTokens(user);

  const tenantUsers = await findTenantUsersByUserId(user.id);
  const tenants = tenantUsers.map((tu: any) => ({
    id: tu.tenant.id,
    name: tu.tenant.name,
    slug: tu.tenant.slug,
    role: tu.role,
  }));

  return { tokens, user, tenants };
}

export async function register(data: { email: string; password: string; name: string }) {
  const existing = await findUserByEmail(data.email);
  if (existing) {
    throw Object.assign(new Error('Email is already registered'), {
      statusCode: 409,
    });
  }

  const passwordHash = await hashPassword(data.password);
  const user = await createUser({
    email: data.email,
    passwordHash,
    name: data.name,
  });

  const tokens = generateTokens(user as User);

  return { tokens, user };
}

export async function refreshTokens(refreshToken: string) {
  const payload = verifyRefreshToken(refreshToken);

  const user = (await findUserById(payload.userId)) as User | null;

  if (!user || !user.isActive) {
    throw Object.assign(new Error('User not found or inactive'), {
      statusCode: 401,
    });
  }

  return generateTokens(user);
}
