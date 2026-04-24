import crypto from 'crypto';
import * as tenantRepo from '../repositories/tenant.repository';
import * as tenantUserRepo from '../repositories/tenantUser.repository';
import { TenantSettings } from '../models/types';
import { defaults } from '../config';

export async function createTenant(data: {
  name: string;
  slug: string;
  settings?: TenantSettings;
}) {
  const apiKey = crypto.randomBytes(48).toString('hex');
  const settings: TenantSettings = {
    draft_debounce_seconds: defaults.draftDebounceSeconds,
    ...(data.settings || {}),
  };
  return tenantRepo.createTenant({
    name: data.name,
    slug: data.slug,
    apiKey,
    settings: settings as Record<string, unknown>,
  });
}

export async function createTenantWithOwner(
  userId: string,
  data: { name: string; slug: string },
) {
  const existing = await tenantRepo.findTenantBySlug(data.slug);
  if (existing) {
    throw Object.assign(new Error('Slug is already taken'), {
      statusCode: 409,
    });
  }

  const tenant = await createTenant({ name: data.name, slug: data.slug });

  const tenantUser = await tenantUserRepo.createTenantUser({
    tenantId: tenant.id,
    userId,
    role: 'owner',
  });

  return { tenant, tenantUser };
}

export async function updateTenant(
  id: string,
  data: { name?: string; settings?: Record<string, unknown>; isActive?: boolean },
) {
  return tenantRepo.updateTenant(id, data);
}

export async function partialUpdateTenant(
  id: string,
  data: { name?: string; settings?: Record<string, unknown> },
) {
  if (data.settings) {
    const existing = await tenantRepo.findTenantById(id);
    if (!existing) return null;

    data.settings = {
      ...(existing.settings as Record<string, unknown> || {}),
      ...data.settings,
    };
  }

  return tenantRepo.updateTenant(id, data);
}

export async function getTenant(id: string) {
  return tenantRepo.findTenantById(id);
}

export async function getTenantById(id: string) {
  return tenantRepo.findTenantById(id);
}

export async function getActiveTenants() {
  return tenantRepo.findAllActiveTenants();
}
