import * as customerRepo from '../repositories/customer.repository';

export async function getCustomers(
  tenantId: string,
  opts?: { email?: string; name?: string; page?: number; limit?: number },
) {
  return customerRepo.findCustomersByTenantId(tenantId, opts);
}

export async function getCustomer(tenantId: string, id: string) {
  return customerRepo.findCustomerById(tenantId, id);
}

export async function getCustomerById(tenantId: string, id: string) {
  return customerRepo.findCustomerById(tenantId, id);
}

export async function upsertCustomer(data: {
  tenantId: string;
  email: string;
  name?: string;
  phone?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}) {
  return customerRepo.upsertCustomer(data);
}

export async function updateMetadata(
  tenantId: string,
  id: string,
  metadata: Record<string, unknown>,
) {
  return customerRepo.updateCustomerMetadata(tenantId, id, metadata);
}

export async function updateCustomerMetadata(
  tenantId: string,
  id: string,
  metadata: Record<string, unknown>,
) {
  return customerRepo.updateCustomerMetadata(tenantId, id, metadata);
}
