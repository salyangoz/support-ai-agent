import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';
import { buildPaginatedResult } from '../utils/pagination';

export async function findDraftsByTicketId(
  tenantId: string,
  ticketId: string,
  opts?: { cursor?: string; limit?: number },
) {
  const where: Record<string, unknown> = { tenantId, ticketId };
  const limit = opts?.limit ?? 20;
  const countWhere = { ...where };

  if (opts?.cursor) {
    where.id = { lt: opts.cursor };
  }

  const total = await getPrisma().draft.count({ where: countWhere });
  const items = await getPrisma().draft.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
  });

  return buildPaginatedResult(items, total, limit);
}

export async function findDraftsByTenantId(
  tenantId: string,
  filters?: { status?: string; cursor?: string; limit?: number; offset?: number },
) {
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) {
    where.status = filters.status;
  }

  const limit = filters?.limit ?? 20;
  const countWhere = { ...where };

  // Legacy offset pagination
  if (filters?.offset && !filters?.cursor) {
    const total = await getPrisma().draft.count({ where: countWhere });
    const items = await getPrisma().draft.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: filters.offset,
      take: limit,
    });
    return buildPaginatedResult(items, total, limit);
  }

  if (filters?.cursor) {
    where.id = { lt: filters.cursor };
  }

  const total = await getPrisma().draft.count({ where: countWhere });
  const items = await getPrisma().draft.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
  });

  return buildPaginatedResult(items, total, limit);
}

export async function findDraftById(tenantId: string, id: string) {
  return getPrisma().draft.findFirst({
    where: { tenantId, id },
  });
}

export async function createDraft(data: {
  ticketId: string;
  tenantId: string;
  promptContext?: string;
  draftResponse: string;
  aiModel?: string;
  aiTokensUsed?: number;
}) {
  return getPrisma().draft.create({
    data: {
      id: generateId(),
      ticketId: data.ticketId,
      tenantId: data.tenantId,
      promptContext: data.promptContext ?? null,
      draftResponse: data.draftResponse,
      aiModel: data.aiModel ?? null,
      aiTokensUsed: data.aiTokensUsed ?? null,
    },
  });
}

export async function updateDraftStatus(
  tenantId: string,
  id: string,
  status: string,
  reviewedBy?: string,
) {
  const existing = await getPrisma().draft.findFirst({
    where: { tenantId, id },
  });

  if (!existing) {
    return null;
  }

  return getPrisma().draft.update({
    where: { id },
    data: {
      status,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: new Date(),
    },
  });
}
