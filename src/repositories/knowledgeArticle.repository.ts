import { Prisma } from '../generated/prisma/client';
import { getPrisma } from '../database/prisma';

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function findArticlesByTenantId(
  tenantId: number,
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

export async function findArticleById(tenantId: number, id: number) {
  return getPrisma().knowledgeArticle.findFirst({
    where: { tenantId, id },
  });
}

export async function createArticle(data: {
  tenantId: number;
  title: string;
  content: string;
  category?: string;
  language?: string;
  embedding?: number[];
}) {
  const prisma = getPrisma();
  const article = await prisma.knowledgeArticle.create({
    data: {
      tenantId: data.tenantId,
      title: data.title,
      content: data.content,
      category: data.category ?? null,
      language: data.language ?? null,
    },
  });

  if (data.embedding) {
    await prisma.$executeRawUnsafe(
      `UPDATE knowledge_articles SET embedding = $1::vector WHERE id = $2`,
      formatEmbedding(data.embedding),
      article.id,
    );
  }

  return article;
}

export async function updateArticle(
  tenantId: number,
  id: number,
  data: {
    title?: string;
    content?: string;
    category?: string;
    language?: string;
    embedding?: number[];
  },
) {
  const prisma = getPrisma();
  const updateData: Prisma.KnowledgeArticleUpdateInput = {};

  if (data.title !== undefined) {
    updateData.title = data.title;
  }
  if (data.content !== undefined) {
    updateData.content = data.content;
  }
  if (data.category !== undefined) {
    updateData.category = data.category;
  }
  if (data.language !== undefined) {
    updateData.language = data.language;
  }

  const hasFields = Object.keys(updateData).length > 0;
  const hasEmbedding = data.embedding !== undefined;

  if (!hasFields && !hasEmbedding) {
    return findArticleById(tenantId, id);
  }

  const existing = await prisma.knowledgeArticle.findFirst({
    where: { tenantId, id },
  });

  if (!existing) {
    return null;
  }

  if (hasFields) {
    await prisma.knowledgeArticle.update({
      where: { id },
      data: updateData,
    });
  }

  if (hasEmbedding) {
    await prisma.$executeRawUnsafe(
      `UPDATE knowledge_articles SET embedding = $1::vector WHERE id = $2`,
      formatEmbedding(data.embedding!),
      id,
    );
  }

  return prisma.knowledgeArticle.findUnique({ where: { id } });
}

export async function softDeleteArticle(tenantId: number, id: number) {
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

export async function findSimilarArticles(
  tenantId: number,
  embedding: number[],
  limit: number,
) {
  return getPrisma().$queryRawUnsafe<
    { id: number; title: string; content: string }[]
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
