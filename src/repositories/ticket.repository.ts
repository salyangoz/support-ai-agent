import { Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

export async function findTicketsByTenantId(
  tenantId: string,
  opts?: {
    inputAppId?: string;
    state?: string;
    customerId?: string;
    page?: number;
    limit?: number;
  },
) {
  const where: Prisma.TicketWhereInput = { tenantId };

  if (opts?.inputAppId) {
    where.inputAppId = opts.inputAppId;
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

export async function findTicketById(tenantId: string, id: string) {
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
  tenantId: string;
  inputAppId: string;
  externalId: string;
  state?: string;
  subject?: string;
  initialBody?: string;
  language?: string;
  assigneeId?: string;
  customerId?: string;
  outputAppId?: string;
  externalCreatedAt?: string | Date;
  externalUpdatedAt?: string | Date;
}) {
  return getPrisma().ticket.upsert({
    where: {
      tenantId_inputAppId_externalId: {
        tenantId: data.tenantId,
        inputAppId: data.inputAppId,
        externalId: data.externalId,
      },
    },
    create: {
      id: generateId(),
      tenantId: data.tenantId,
      inputAppId: data.inputAppId,
      externalId: data.externalId,
      state: data.state ?? 'open',
      subject: data.subject ?? null,
      initialBody: data.initialBody ?? null,
      language: data.language ?? null,
      assigneeId: data.assigneeId ?? null,
      customerId: data.customerId ?? null,
      outputAppId: data.outputAppId ?? null,
      externalCreatedAt: data.externalCreatedAt
        ? new Date(data.externalCreatedAt as string) : null,
      externalUpdatedAt: data.externalUpdatedAt
        ? new Date(data.externalUpdatedAt as string) : null,
    },
    update: {
      state: data.state ?? undefined,
      subject: data.subject ?? undefined,
      initialBody: data.initialBody ?? undefined,
      language: data.language ?? undefined,
      assigneeId: data.assigneeId ?? undefined,
      customerId: data.customerId ?? undefined,
      outputAppId: data.outputAppId ?? undefined,
      externalUpdatedAt: data.externalUpdatedAt
        ? new Date(data.externalUpdatedAt as string) : undefined,
    },
  });
}

export async function updateTicketState(
  tenantId: string,
  id: string,
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
  tenantId: string,
  id: string,
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

export async function updateTicketOutputApp(
  tenantId: string,
  id: string,
  outputAppId: string,
) {
  return getPrisma().ticket.updateMany({
    where: { tenantId, id },
    data: { outputAppId },
  }).then(async (result) => {
    if (result.count === 0) {
      return null;
    }
    return getPrisma().ticket.findUnique({ where: { id } });
  });
}
