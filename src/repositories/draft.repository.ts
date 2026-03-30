import { getPrisma } from '../database/prisma';

export async function findDraftsByTicketId(
  tenantId: number,
  ticketId: number,
) {
  return getPrisma().draft.findMany({
    where: { tenantId, ticketId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function findDraftById(tenantId: number, id: number) {
  return getPrisma().draft.findFirst({
    where: { tenantId, id },
  });
}

export async function createDraft(data: {
  ticketId: number;
  tenantId: number;
  promptContext?: string;
  draftResponse: string;
  aiModel?: string;
  aiTokensUsed?: number;
}) {
  return getPrisma().draft.create({
    data: {
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
  tenantId: number,
  id: number,
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
