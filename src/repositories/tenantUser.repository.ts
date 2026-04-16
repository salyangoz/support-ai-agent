import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

export async function findTenantUser(tenantId: string, userId: string) {
  return getPrisma().tenantUser.findUnique({
    where: { tenantId_userId: { tenantId, userId } },
  });
}

export async function findTenantUsersByTenantId(tenantId: string) {
  return getPrisma().tenantUser.findMany({
    where: { tenantId },
    include: { user: true },
  });
}

export async function findTenantUsersByUserId(userId: string) {
  return getPrisma().tenantUser.findMany({
    where: { userId, isActive: true },
    include: { tenant: true },
  });
}

export async function createTenantUser(data: {
  tenantId: string;
  userId: string;
  role: string;
}) {
  return getPrisma().tenantUser.create({
    data: {
      id: generateId(),
      ...data,
    },
  });
}

export async function updateTenantUser(
  id: string,
  data: {
    role?: string;
    isActive?: boolean;
  },
) {
  const updateData: Record<string, unknown> = {};

  if (data.role !== undefined) updateData.role = data.role;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length === 0) {
    return getPrisma().tenantUser.findUnique({ where: { id } });
  }

  return getPrisma().tenantUser.update({
    where: { id },
    data: updateData,
  });
}

export async function findOwnerByTenantId(tenantId: string) {
  return getPrisma().tenantUser.findFirst({
    where: { tenantId, role: 'owner' },
  });
}
