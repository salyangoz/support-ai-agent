import crypto from 'crypto';
import * as tenantRepo from '../repositories/tenant.repository';
import { TenantSettings } from '../models/types';

export async function createTenant(data: {
  name: string;
  slug: string;
  settings?: TenantSettings;
}) {
  const apiKey = crypto.randomBytes(48).toString('hex');
  return tenantRepo.createTenant({
    name: data.name,
    slug: data.slug,
    apiKey,
    settings: data.settings as Record<string, unknown> | undefined,
  });
}

export async function updateTenant(
  id: number,
  data: { name?: string; settings?: Record<string, unknown>; isActive?: boolean },
) {
  return tenantRepo.updateTenant(id, data);
}

export async function getTenant(id: number) {
  return tenantRepo.findTenantById(id);
}

export async function getTenantById(id: number) {
  return tenantRepo.findTenantById(id);
}

export async function getActiveTenants() {
  return tenantRepo.findAllActiveTenants();
}
