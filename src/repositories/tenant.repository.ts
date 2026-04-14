import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

export async function findTenantById(id: string) {
  return getPrisma().tenant.findUnique({ where: { id } });
}

export async function findTenantBySlug(slug: string) {
  return getPrisma().tenant.findUnique({ where: { slug } });
}

export async function findTenantByApiKey(apiKey: string) {
  return getPrisma().tenant.findFirst({
    where: { apiKey, isActive: true },
  });
}

export async function findAllActiveTenants() {
  return getPrisma().tenant.findMany({ where: { isActive: true } });
}

export async function createTenant(data: {
  name: string;
  slug: string;
  apiKey: string;
  settings?: Record<string, unknown>;
}) {
  return getPrisma().tenant.create({
    data: {
      id: generateId(),
      name: data.name,
      slug: data.slug,
      apiKey: data.apiKey,
      settings: (data.settings ?? {}) as any,
    },
  });
}

export async function updateTenant(
  id: string,
  data: {
    name?: string;
    settings?: Record<string, unknown>;
    isActive?: boolean;
  },
) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) {
    updateData.name = data.name;
  }
  if (data.settings !== undefined) {
    updateData.settings = data.settings;
  }
  if (data.isActive !== undefined) {
    updateData.isActive = data.isActive;
  }

  if (Object.keys(updateData).length === 0) {
    return findTenantById(id);
  }

  return getPrisma().tenant.update({
    where: { id },
    data: updateData,
  }).catch(() => null);
}
