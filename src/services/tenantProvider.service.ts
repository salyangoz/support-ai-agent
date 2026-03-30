import * as providerRepo from '../repositories/tenantProvider.repository';

export async function getProviders(tenantId: number) {
  return providerRepo.findProvidersByTenantId(tenantId);
}

export async function getProvider(tenantId: number, provider: string) {
  return providerRepo.findProvider(tenantId, provider);
}

export async function addProvider(data: {
  tenantId: number;
  provider: string;
  credentials: Record<string, unknown>;
  webhookSecret?: string;
}) {
  return providerRepo.createProvider(data);
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
  return providerRepo.updateProvider(tenantId, provider, data);
}

export async function removeProvider(tenantId: number, provider: string) {
  return providerRepo.deleteProvider(tenantId, provider);
}
