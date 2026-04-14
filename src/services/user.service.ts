import { hashPassword } from './auth.service';
import * as userRepo from '../repositories/user.repository';
import * as tenantUserRepo from '../repositories/tenantUser.repository';
import { UserRole } from '../models/types';

export async function listTenantMembers(tenantId: string) {
  return tenantUserRepo.findTenantUsersByTenantId(tenantId);
}

export async function getTenantMember(tenantId: string, userId: string) {
  return tenantUserRepo.findTenantUser(tenantId, userId);
}

export async function inviteUser(
  tenantId: string,
  data: { email: string; password: string; name: string; role: UserRole },
) {
  if (data.role === 'owner') {
    const existingOwner = await tenantUserRepo.findOwnerByTenantId(tenantId);
    if (existingOwner) {
      throw Object.assign(new Error('Tenant already has an owner'), {
        statusCode: 400,
      });
    }
  }

  let user = await userRepo.findUserByEmail(data.email);

  if (!user) {
    const passwordHash = await hashPassword(data.password);
    user = await userRepo.createUser({
      email: data.email,
      passwordHash,
      name: data.name,
    });
  }

  const existing = await tenantUserRepo.findTenantUser(tenantId, user.id);
  if (existing) {
    throw Object.assign(new Error('User is already a member of this tenant'), {
      statusCode: 409,
    });
  }

  const tenantUser = await tenantUserRepo.createTenantUser({
    tenantId,
    userId: user.id,
    role: data.role,
  });

  return { user, tenantUser };
}

export async function updateMembership(
  tenantId: string,
  userId: string,
  data: { role?: UserRole; isActive?: boolean },
) {
  const tenantUser = await tenantUserRepo.findTenantUser(tenantId, userId);
  if (!tenantUser) {
    return null;
  }

  if (tenantUser.role === 'owner' && data.isActive === false) {
    throw Object.assign(new Error('Cannot deactivate the owner'), {
      statusCode: 400,
    });
  }

  if (data.role === 'owner' && tenantUser.role !== 'owner') {
    const existingOwner = await tenantUserRepo.findOwnerByTenantId(tenantId);
    if (existingOwner) {
      throw Object.assign(new Error('Tenant already has an owner'), {
        statusCode: 400,
      });
    }
  }

  return tenantUserRepo.updateTenantUser(tenantUser.id, data);
}

export async function removeMembership(tenantId: string, userId: string) {
  const tenantUser = await tenantUserRepo.findTenantUser(tenantId, userId);
  if (!tenantUser) {
    return null;
  }

  if (tenantUser.role === 'owner') {
    throw Object.assign(new Error('Cannot remove the owner'), {
      statusCode: 400,
    });
  }

  return tenantUserRepo.updateTenantUser(tenantUser.id, { isActive: false });
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string,
) {
  const { verifyPassword } = await import('./auth.service');

  const user = await userRepo.findUserById(userId);
  if (!user) {
    throw Object.assign(new Error('User not found'), { statusCode: 404 });
  }

  const valid = await verifyPassword(oldPassword, user.passwordHash);
  if (!valid) {
    throw Object.assign(new Error('Invalid current password'), {
      statusCode: 401,
    });
  }

  const passwordHash = await hashPassword(newPassword);
  return userRepo.updateUser(userId, { passwordHash });
}
