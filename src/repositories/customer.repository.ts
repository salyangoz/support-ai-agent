import { Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';
import { buildPaginatedResult } from '../utils/pagination';

export async function findCustomersByTenantId(
  tenantId: string,
  opts?: {
    email?: string;
    name?: string;
    cursor?: string;
    limit?: number;
    page?: number;
  },
) {
  const where: Prisma.CustomerWhereInput = { tenantId };

  if (opts?.email) {
    where.email = opts.email;
  }

  if (opts?.name) {
    where.name = { contains: opts.name, mode: 'insensitive' };
  }

  const limit = opts?.limit ?? 20;
  const countWhere = { ...where };

  const include = { _count: { select: { tickets: true } } };

  if (opts?.page && !opts?.cursor) {
    const total = await getPrisma().customer.count({ where: countWhere });
    const items = await getPrisma().customer.findMany({
      where,
      include,
      orderBy: { id: 'desc' },
      skip: (opts.page - 1) * limit,
      take: limit,
    });
    return buildPaginatedResult(
      items.map(({ _count, ...c }) => ({ ...c, ticketCount: _count.tickets })),
      total,
      limit,
    );
  }

  if (opts?.cursor) {
    where.id = { lt: opts.cursor };
  }

  const total = await getPrisma().customer.count({ where: countWhere });
  const items = await getPrisma().customer.findMany({
    where,
    include,
    orderBy: { id: 'desc' },
    take: limit,
  });

  return buildPaginatedResult(
    items.map(({ _count, ...c }) => ({ ...c, ticketCount: _count.tickets })),
    total,
    limit,
  );
}

export async function findCustomerById(tenantId: string, id: string) {
  const customer = await getPrisma().customer.findFirst({
    where: { tenantId, id },
    include: { _count: { select: { tickets: true } } },
  });
  if (!customer) return null;
  const { _count, ...rest } = customer;
  return { ...rest, ticketCount: _count.tickets };
}

export async function findCustomerByEmail(tenantId: string, email: string) {
  return getPrisma().customer.findUnique({
    where: { tenantId_email: { tenantId, email } },
  });
}

export async function upsertCustomer(data: {
  tenantId: string;
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
      id: generateId(),
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
  tenantId: string,
  id: string,
  metadata: Record<string, unknown>,
) {
  return getPrisma().customer.update({
    where: { id },
    data: { metadata: metadata as any },
  }).then((c) => (c.tenantId === tenantId ? c : null))
    .catch(() => null);
}
