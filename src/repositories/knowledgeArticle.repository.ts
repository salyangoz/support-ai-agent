import { Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function findArticlesByTenantId(
  tenantId: string,
  opts?: {
    category?: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  },
) {
  const where: Prisma.KnowledgeArticleWhereInput = { tenantId };

  if (opts?.category) {
    where.category = opts.category;
  }

  if (opts?.search) {
    where.OR = [
      { title: { contains: opts.search, mode: 'insensitive' } },
      { content: { contains: opts.search, mode: 'insensitive' } },
    ];
  }

  if (opts?.isActive !== undefined) {
    where.isActive = opts.isActive;
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;

  return getPrisma().knowledgeArticle.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });
}

export async function findArticleById(tenantId: string, id: string) {
  return getPrisma().knowledgeArticle.findFirst({
    where: { tenantId, id },
  });
}

export async function findArticleByExternalId(tenantId: string, externalId: string) {
  return getPrisma().knowledgeArticle.findFirst({
    where: { tenantId, externalId },
  });
}

export async function createArticle(data: {
  tenantId: string;
  title: string;
  content: string;
  category?: string;
  language?: string;
  externalId?: string;
}) {
  return getPrisma().knowledgeArticle.create({
    data: {
      id: generateId(),
      tenantId: data.tenantId,
      title: data.title,
      content: data.content,
      category: data.category ?? null,
      language: data.language ?? null,
      externalId: data.externalId ?? null,
    },
  });
}

export async function updateArticle(
  tenantId: string,
  id: string,
  data: {
    title?: string;
    content?: string;
    category?: string;
    language?: string;
  },
) {
  const updateData: Prisma.KnowledgeArticleUpdateInput = {};

  if (data.title !== undefined) updateData.title = data.title;
  if (data.content !== undefined) updateData.content = data.content;
  if (data.category !== undefined) updateData.category = data.category;
  if (data.language !== undefined) updateData.language = data.language;

  if (Object.keys(updateData).length === 0) {
    return findArticleById(tenantId, id);
  }

  return getPrisma().knowledgeArticle.update({
    where: { id },
    data: updateData,
  }).catch(() => null);
}

export async function softDeleteArticle(tenantId: string, id: string) {
  const existing = await getPrisma().knowledgeArticle.findFirst({
    where: { tenantId, id },
  });

  if (!existing) {
    return null;
  }

  return getPrisma().knowledgeArticle.update({
    where: { id },
    data: { isActive: false },
  });
}

export async function findArticlesWithoutEmbedding(tenantId: string) {
  return getPrisma().$queryRawUnsafe<
    { id: string; title: string; content: string }[]
  >(
    `SELECT id, title, content
     FROM knowledge_articles
     WHERE tenant_id = $1
       AND is_active = true
       AND embedding IS NULL`,
    tenantId,
  );
}

export async function updateArticleEmbedding(id: string, embedding: number[]) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE knowledge_articles SET embedding = $1::vector WHERE id = $2`,
    formatEmbedding(embedding),
    id,
  );
}

export async function findSimilarArticles(
  tenantId: string,
  embedding: number[],
  limit: number,
) {
  return getPrisma().$queryRawUnsafe<
    { id: string; title: string; content: string }[]
  >(
    `SELECT id, title, content
     FROM knowledge_articles
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    tenantId,
    formatEmbedding(embedding),
    limit,
  );
}
