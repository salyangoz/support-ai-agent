import { getPrisma } from '../database/prisma';

export async function findProvidersByTenantId(tenantId: number) {
  return getPrisma().tenantProvider.findMany({
    where: { tenantId },
  });
}

export async function findProvider(tenantId: number, provider: string) {
  return getPrisma().tenantProvider.findUnique({
    where: { tenantId_provider: { tenantId, provider } },
  });
}

export async function createProvider(data: {
  tenantId: number;
  provider: string;
  credentials: Record<string, unknown>;
  webhookSecret?: string;
}) {
  return getPrisma().tenantProvider.create({
    data: {
      tenantId: data.tenantId,
      provider: data.provider,
      credentials: data.credentials as any,
      webhookSecret: data.webhookSecret ?? null,
    },
  });
}

export async function updateProvider(
  tenantId: number,
  provider: string,
  data: {
    credentials?: Record<string, unknown>;
    webhookSecret?: string;
    isActive?: boolean;
  },
) {
  const updateData: Record<string, unknown> = {};

  if (data.credentials !== undefined) {
    updateData.credentials = data.credentials as any;
  }
  if (data.webhookSecret !== undefined) {
    updateData.webhookSecret = data.webhookSecret;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  if (Object.keys(updateData).length === 0) {
    return findProvider(tenantId, provider);
  }

  return getPrisma().tenantProvider.update({
    where: { tenantId_provider: { tenantId, provider } },
    data: updateData,
  }).catch(() => null);
}

export async function deleteProvider(tenantId: number, provider: string) {
  await getPrisma().tenantProvider.delete({
    where: { tenantId_provider: { tenantId, provider } },
  }).catch(() => null);
}
