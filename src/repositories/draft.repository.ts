import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

export async function findDraftsByTicketId(
  tenantId: string,
  ticketId: string,
) {
  return getPrisma().draft.findMany({
    where: { tenantId, ticketId },
    orderBy: { createdAt: 'desc' },
  });
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
