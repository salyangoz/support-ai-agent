import * as articleRepo from '../repositories/knowledgeArticle.repository';
import { embed } from './embedding.service';

export async function getArticles(
  tenantId: number,
  opts?: {
    category?: string;
    search?: string;
    isActive?: boolean;
    page?: number;
    limit?: number;
  },
) {
  return articleRepo.findArticlesByTenantId(tenantId, opts);
}

export async function getArticle(tenantId: number, id: number) {
  return articleRepo.findArticleById(tenantId, id);
}

export async function getArticleById(tenantId: number, id: number) {
  return articleRepo.findArticleById(tenantId, id);
}

export async function createArticle(data: {
  tenantId: number;
  title: string;
  content: string;
  category?: string;
  language?: string;
}) {
  const embedding = await embed(data.title + ' ' + data.content);
  return articleRepo.createArticle({
    tenantId: data.tenantId,
    title: data.title,
    content: data.content,
    category: data.category,
    language: data.language,
    embedding: embedding ?? undefined,
  });
}

export async function updateArticle(
  tenantId: number,
  id: number,
  data: { title?: string; content?: string; category?: string; language?: string },
) {
  let embedding: number[] | undefined;

  if (data.title !== undefined || data.content !== undefined) {
    const existing = await articleRepo.findArticleById(tenantId, id);
    if (existing) {
      const title = data.title ?? existing.title;
      const content = data.content ?? existing.content;
      const result = await embed(title + ' ' + content);
      embedding = result ?? undefined;
    }
  }

  return articleRepo.updateArticle(tenantId, id, {
    ...data,
    embedding,
  });
}

export async function deleteArticle(tenantId: number, id: number) {
  return articleRepo.softDeleteArticle(tenantId, id);
}

export async function softDeleteArticle(tenantId: number, id: number) {
  return articleRepo.softDeleteArticle(tenantId, id);
}

export async function findSimilar(
  tenantId: number,
  embedding: number[],
  limit: number,
) {
  return articleRepo.findSimilarArticles(tenantId, embedding, limit);
}
