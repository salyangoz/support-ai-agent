import * as appRepo from '../repositories/app.repository';

export async function getApps(
  tenantId: string,
  filters?: { type?: string; role?: string; code?: string; isActive?: boolean },
) {
  return appRepo.findAppsByTenantId(tenantId, filters);
}

export async function getApp(tenantId: string, appId: string) {
  return appRepo.findAppById(tenantId, appId);
}

export async function getActiveInputApps(tenantId: string) {
  return appRepo.findActiveInputApps(tenantId);
}

export async function getActiveOutputApps(tenantId: string) {
  return appRepo.findActiveOutputApps(tenantId);
}

export async function addApp(data: {
  tenantId: string;
  code: string;
  type: string;
  role: string;
  name?: string;
  credentials: Record<string, unknown>;
  webhookSecret?: string;
  config?: Record<string, unknown>;
}) {
  return appRepo.createApp(data);
}

export async function updateApp(
  tenantId: string,
  appId: string,
  data: {
    name?: string;
    credentials?: Record<string, unknown>;
    webhookSecret?: string;
    config?: Record<string, unknown>;
    isActive?: boolean;
    role?: string;
  },
) {
  return appRepo.updateApp(tenantId, appId, data);
}

export async function removeApp(tenantId: string, appId: string) {
  return appRepo.deleteApp(tenantId, appId);
}

export async function getActiveTenantApps(tenantId: string) {
  return appRepo.findAppsByTenantId(tenantId, { isActive: true });
}
