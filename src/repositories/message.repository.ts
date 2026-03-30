import { getPrisma } from '../database/prisma';

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function findMessagesByTicketId(
  ticketId: number,
  tenantId: number,
) {
  return getPrisma().message.findMany({
    where: { ticketId, tenantId },
    orderBy: { externalCreatedAt: 'asc' },
  });
}

export async function upsertMessage(data: {
  ticketId: number;
  tenantId: number;
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
    return prisma.message.update({
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
  }

  return prisma.message.create({
    data: {
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
}

export async function updateMessageEmbedding(
  id: number,
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
  tenantId: number,
  embedding: number[],
  excludeTicketId: number,
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

export async function findMessagesWithoutEmbedding(tenantId: number) {
  return getPrisma().$queryRawUnsafe<any[]>(
    `SELECT * FROM messages
     WHERE tenant_id = $1
       AND author_role = 'agent'
       AND embedding IS NULL`,
    tenantId,
  );
}
