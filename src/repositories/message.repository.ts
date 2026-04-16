import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function findMessagesByTicketId(
  ticketId: string,
  tenantId: string,
) {
  return getPrisma().message.findMany({
    where: { ticketId, tenantId },
    orderBy: { externalCreatedAt: 'asc' },
    include: { attachments: true },
  });
}

export async function findMessageByExternalId(ticketId: string, externalId: string) {
  return getPrisma().message.findUnique({
    where: { ticketId_externalId: { ticketId, externalId } },
  });
}

export async function upsertMessage(data: {
  ticketId: string;
  tenantId: string;
  externalId: string;
  authorRole: string;
  authorId?: string;
  authorName?: string;
  body?: string;
  externalCreatedAt?: string;
}) {
  const prisma = getPrisma();
  const existing = await prisma.message.findUnique({
    where: {
      ticketId_externalId: {
        ticketId: data.ticketId,
        externalId: data.externalId,
      },
    },
  });

  if (existing) {
    const msg = await prisma.message.update({
      where: { id: existing.id },
      data: {
        authorRole: data.authorRole ?? existing.authorRole,
        authorId: data.authorId ?? existing.authorId,
        authorName: data.authorName ?? existing.authorName,
        body: data.body ?? existing.body,
        externalCreatedAt: data.externalCreatedAt
          ? new Date(data.externalCreatedAt)
          : existing.externalCreatedAt,
      },
    });
    await updateTicketLastMessage(data.ticketId, msg);
    return msg;
  }

  const msg = await prisma.message.create({
    data: {
      id: generateId(),
      ticketId: data.ticketId,
      tenantId: data.tenantId,
      externalId: data.externalId,
      authorRole: data.authorRole,
      authorId: data.authorId ?? null,
      authorName: data.authorName ?? null,
      body: data.body ?? null,
      externalCreatedAt: data.externalCreatedAt
        ? new Date(data.externalCreatedAt) : null,
    },
  });
  await updateTicketLastMessage(data.ticketId, msg);
  return msg;
}

async function updateTicketLastMessage(
  ticketId: string,
  message: { authorRole: string; authorName: string | null; createdAt: Date },
) {
  const msgTime = message.createdAt;

  const ticket = await getPrisma().ticket.findUnique({
    where: { id: ticketId },
    select: { lastMessageAt: true },
  });

  // Only update if this message is newer
  if (!ticket?.lastMessageAt || msgTime >= ticket.lastMessageAt) {
    await getPrisma().ticket.update({
      where: { id: ticketId },
      data: {
        lastMessageAt: msgTime,
        lastMessageBy: message.authorName,
        lastMessageRole: message.authorRole,
      },
    });
  }
}

export async function updateMessageEmbedding(
  id: string,
  embedding: number[],
) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE messages SET embedding = $1::vector WHERE id = $2`,
    formatEmbedding(embedding),
    id,
  );
  return prisma.message.findUnique({ where: { id } });
}

export async function findSimilarAgentMessages(
  tenantId: string,
  embedding: number[],
  excludeTicketId: string,
  limit: number,
) {
  const prisma = getPrisma();
  const results = await prisma.$queryRawUnsafe<
    { body: string; initial_body: string }[]
  >(
    `SELECT m.body, t.initial_body
     FROM messages m
     JOIN tickets t ON t.id = m.ticket_id
     WHERE m.tenant_id = $1
       AND m.author_role = 'agent'
       AND m.embedding IS NOT NULL
       AND m.ticket_id != $2
     ORDER BY m.embedding <=> $3::vector
     LIMIT $4`,
    tenantId,
    excludeTicketId,
    formatEmbedding(embedding),
    limit,
  );
  return results;
}

export async function findMessagesWithoutEmbedding(tenantId: string) {
  return getPrisma().$queryRawUnsafe<any[]>(
    `SELECT * FROM messages
     WHERE tenant_id = $1
       AND author_role = 'agent'
       AND embedding IS NULL`,
    tenantId,
  );
}
