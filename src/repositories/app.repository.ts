import { getPrisma } from '../database/prisma';

export async function findAppsByTenantId(
  tenantId: number,
  filters?: { type?: string; role?: string; code?: string; isActive?: boolean },
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.type) where.type = filters.type;
  if (filters?.role) where.role = filters.role;
  if (filters?.code) where.code = filters.code;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  return getPrisma().app.findMany({ where });
}

export async function findAppById(tenantId: number, appId: number) {
  return getPrisma().app.findFirst({
    where: { id: appId, tenantId },
  });
}

export async function findActiveInputApps(tenantId: number) {
  return getPrisma().app.findMany({
    where: {
      tenantId,
      type: 'ticket',
      role: { in: ['source', 'both'] },
      isActive: true,
    },
  });
}

export async function findActiveOutputApps(tenantId: number) {
  return getPrisma().app.findMany({
    where: {
      tenantId,
      type: 'ticket',
      role: { in: ['destination', 'both'] },
      isActive: true,
    },
  });
}

export async function createApp(data: {
  tenantId: number;
  code: string;
  type: string;
  role: string;
  name?: string;
  credentials: Record<string, unknown>;
  webhookSecret?: string;
  config?: Record<string, unknown>;
}) {
  return getPrisma().app.create({
    data: {
      tenantId: data.tenantId,
      code: data.code,
      type: data.type,
      role: data.role,
      name: data.name ?? null,
      credentials: data.credentials as any,
      webhookSecret: data.webhookSecret ?? null,
      config: (data.config ?? {}) as any,
    },
  });
}

export async function updateApp(
  tenantId: number,
  appId: number,
  data: {
    name?: string;
    credentials?: Record<string, unknown>;
    webhookSecret?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
    role?: string;
  },
) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.credentials !== undefined) updateData.credentials = data.credentials as any;
  if (data.webhookSecret !== undefined) updateData.webhookSecret = data.webhookSecret;
  if (data.config !== undefined) updateData.config = data.config as any;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;
  if (data.role !== undefined) updateData.role = data.role;

  if (Object.keys(updateData).length === 0) {
    return findAppById(tenantId, appId);
  }

  return getPrisma().app.update({
    where: { id: appId },
    data: updateData,
  }).catch(() => null);
}

export async function deleteApp(tenantId: number, appId: number) {
  await getPrisma().app.delete({
    where: { id: appId },
  }).catch(() => null);
}
