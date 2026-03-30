import * as customerRepo from '../repositories/customer.repository';

export async function getCustomers(
  tenantId: number,
  opts?: { email?: string; name?: string; page?: number; limit?: number },
) {
  return customerRepo.findCustomersByTenantId(tenantId, opts);
}

export async function getCustomer(tenantId: number, id: number) {
  return customerRepo.findCustomerById(tenantId, id);
}

export async function getCustomerById(tenantId: number, id: number) {
  return customerRepo.findCustomerById(tenantId, id);
}

export async function upsertCustomer(data: {
  tenantId: number;
  email: string;
  name?: string;
  phone?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}) {
  return customerRepo.upsertCustomer(data);
}

export async function updateMetadata(
  tenantId: number,
  id: number,
  metadata: Record<string, unknown>,
) {
  return customerRepo.updateCustomerMetadata(tenantId, id, metadata);
}

export async function updateCustomerMetadata(
  tenantId: number,
  id: number,
  metadata: Record<string, unknown>,
) {
  return customerRepo.updateCustomerMetadata(tenantId, id, metadata);
}
