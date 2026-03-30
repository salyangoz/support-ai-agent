import { Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/prisma';

export async function findCustomersByTenantId(
  tenantId: number,
  opts?: {
    email?: string;
    name?: string;
    page?: number;
    limit?: number;
  },
) {
  const where: Prisma.CustomerWhereInput = { tenantId };

  if (opts?.email) {
    where.email = opts.email;
  }

  if (opts?.name) {
    where.name = { contains: opts.name, mode: 'insensitive' };
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;

  return getPrisma().customer.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function findCustomerById(tenantId: number, id: number) {
  return getPrisma().customer.findFirst({
    where: { tenantId, id },
  });
}

export async function findCustomerByEmail(tenantId: number, email: string) {
  return getPrisma().customer.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
}

export async function upsertCustomer(data: {
  tenantId: number;
  email: string;
  name?: string;
  phone?: string;
  externalId?: string;
  metadata?: Record<string, unknown>;
}) {
  return getPrisma().customer.upsert({
    where: {
      tenantId_email: { tenantId: data.tenantId, email: data.email },
    },
    create: {
      tenantId: data.tenantId,
      email: data.email,
      name: data.name ?? null,
      phone: data.phone ?? null,
      externalId: data.externalId ?? null,
      metadata: (data.metadata ?? {}) as any,
    },
    update: {
      name: data.name ?? undefined,
      phone: data.phone ?? undefined,
      externalId: data.externalId ?? undefined,
      metadata: data.metadata ? (data.metadata as any) : undefined,
    },
  });
}

export async function updateCustomerMetadata(
  tenantId: number,
  id: number,
  metadata: Record<string, unknown>,
) {
  return getPrisma().customer.update({
    where: { id },
    data: { metadata: metadata as any },
  }).then((c) => (c.tenantId === tenantId ? c : null))
    .catch(() => null);
}
