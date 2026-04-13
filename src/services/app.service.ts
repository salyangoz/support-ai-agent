import * as appRepo from '../repositories/app.repository';

export async function getApps(
  tenantId: number,
  filters?: { type?: string; role?: string; code?: string; isActive?: boolean },
) {
  return appRepo.findAppsByTenantId(tenantId, filters);
}

export async function getApp(tenantId: number, appId: number) {
  return appRepo.findAppById(tenantId, appId);
}

export async function getActiveInputApps(tenantId: number) {
  return appRepo.findActiveInputApps(tenantId);
}

export async function getActiveOutputApps(tenantId: number) {
  return appRepo.findActiveOutputApps(tenantId);
}

export async function addApp(data: {
  tenantId: number;
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
  return appRepo.updateApp(tenantId, appId, data);
}

export async function removeApp(tenantId: number, appId: number) {
  return appRepo.deleteApp(tenantId, appId);
}

export async function getActiveTenantApps(tenantId: number) {
  return appRepo.findAppsByTenantId(tenantId, { isActive: true });
}
