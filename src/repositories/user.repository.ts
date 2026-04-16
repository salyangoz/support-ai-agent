import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

export async function findUserById(id: string) {
  return getPrisma().user.findUnique({ where: { id } });
}

export async function findUserByEmail(email: string) {
  return getPrisma().user.findUnique({ where: { email } });
}

export async function createUser(data: {
  email: string;
  passwordHash: string;
  name: string;
}) {
  return getPrisma().user.create({
    data: {
      id: generateId(),
      ...data,
    },
  });
}

export async function updateUser(
  id: string,
  data: {
    name?: string;
    passwordHash?: string;
    isActive?: boolean;
  },
) {
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.passwordHash !== undefined) updateData.passwordHash = data.passwordHash;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  if (Object.keys(updateData).length === 0) {
    return findUserById(id);
  }

  return getPrisma().user.update({
    where: { id },
    data: updateData,
  });
}

export async function updateLastLogin(id: string) {
  return getPrisma().user.update({
    where: { id },
    data: { lastLoginAt: new Date() },
  });
}
