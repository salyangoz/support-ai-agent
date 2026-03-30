import { Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/prisma';

export async function findTicketsByTenantId(
  tenantId: number,
  opts?: {
    provider?: string;
    state?: string;
    customerId?: number;
    page?: number;
    limit?: number;
  },
) {
  const where: Prisma.TicketWhereInput = { tenantId };

  if (opts?.provider) {
    where.provider = opts.provider;
  }
  if (opts?.state) {
    where.state = opts.state;
  }
  if (opts?.customerId) {
    where.customerId = opts.customerId;
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;

  return getPrisma().ticket.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function findTicketById(tenantId: number, id: number) {
  return getPrisma().ticket.findFirst({
    where: { tenantId, id },
    include: {
      customer: {
        select: { email: true, name: true },
      },
    },
  }).then((ticket) => {
    if (!ticket) {
      return null;
    }
    const { customer, ...rest } = ticket;
    return {
      ...rest,
      customer_email: customer?.email ?? null,
      customer_name: customer?.name ?? null,
    };
  });
}

export async function upsertTicket(data: {
  tenantId: number;
  provider: string;
  externalId: string;
  state?: string;
  subject?: string;
  initialBody?: string;
  language?: string;
  assigneeId?: string;
  customerId?: number;
  externalCreatedAt?: string;
  externalUpdatedAt?: string;
}) {
  return getPrisma().ticket.upsert({
    where: {
      tenantId_provider_externalId: {
        tenantId: data.tenantId,
        provider: data.provider,
        externalId: data.externalId,
      },
    },
    create: {
      tenantId: data.tenantId,
      provider: data.provider,
      externalId: data.externalId,
      state: data.state ?? 'open',
      subject: data.subject ?? null,
      initialBody: data.initialBody ?? null,
      language: data.language ?? null,
      assigneeId: data.assigneeId ?? null,
      customerId: data.customerId ?? null,
      externalCreatedAt: data.externalCreatedAt
        ? new Date(data.externalCreatedAt) : null,
      externalUpdatedAt: data.externalUpdatedAt
        ? new Date(data.externalUpdatedAt) : null,
    },
    update: {
      state: data.state ?? undefined,
      subject: data.subject ?? undefined,
      initialBody: data.initialBody ?? undefined,
      language: data.language ?? undefined,
      assigneeId: data.assigneeId ?? undefined,
      customerId: data.customerId ?? undefined,
      externalUpdatedAt: data.externalUpdatedAt
        ? new Date(data.externalUpdatedAt) : undefined,
    },
  });
}

export async function updateTicketState(
  tenantId: number,
  id: number,
  state: string,
) {
  return getPrisma().ticket.updateMany({
    where: { tenantId, id },
    data: { state },
  }).then(async (result) => {
    if (result.count === 0) {
      return null;
    }
    return getPrisma().ticket.findUnique({ where: { id } });
  });
}

export async function updateTicketAssignee(
  tenantId: number,
  id: number,
  assigneeId: string,
) {
  return getPrisma().ticket.updateMany({
    where: { tenantId, id },
    data: { assigneeId },
  }).then(async (result) => {
    if (result.count === 0) {
      return null;
    }
    return getPrisma().ticket.findUnique({ where: { id } });
  });
}
