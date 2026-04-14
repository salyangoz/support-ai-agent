import * as articleRepo from '../repositories/knowledgeArticle.repository';
import * as chunkRepo from '../repositories/knowledgeChunk.repository';
import * as tenantRepo from '../repositories/tenant.repository';
import { chunkText } from './chunking.service';
import { logger } from '../utils/logger';

export async function getArticles(
  tenantId: string,
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

export async function getArticle(tenantId: string, id: string) {
  return articleRepo.findArticleById(tenantId, id);
}

export async function getArticleById(tenantId: string, id: string) {
  return articleRepo.findArticleById(tenantId, id);
}

export async function createArticle(data: {
  tenantId: string;
  title: string;
  content: string;
  category?: string;
  language?: string;
  externalId?: string;
}) {
  const article = await articleRepo.createArticle({
    tenantId: data.tenantId,
    title: data.title,
    content: data.content,
    category: data.category,
    language: data.language,
    externalId: data.externalId,
  });

  await rechunkArticle(article.id, data.tenantId, data.title + '\n\n' + data.content);

  return article;
}

export async function updateArticle(
  tenantId: string,
  id: string,
  data: { title?: string; content?: string; category?: string; language?: string },
) {
  const existing = await articleRepo.findArticleById(tenantId, id);
  if (!existing) return null;

  const article = await articleRepo.updateArticle(tenantId, id, data);

  if (data.title !== undefined || data.content !== undefined) {
    const title = data.title ?? existing.title;
    const content = data.content ?? existing.content;
    await rechunkArticle(id, tenantId, title + '\n\n' + content);
  }

  return article;
}

export async function upsertArticleByExternalId(
  tenantId: string,
  externalId: string,
  data: { title: string; content: string; category?: string; language?: string },
) {
  const existing = await articleRepo.findArticleByExternalId(tenantId, externalId);

  if (existing) {
    if (existing.title === data.title && existing.content === data.content) {
      return existing; // no change
    }
    return updateArticle(tenantId, existing.id, data);
  }

  return createArticle({ tenantId, externalId, ...data });
}

export async function deleteArticle(tenantId: string, id: string) {
  return articleRepo.softDeleteArticle(tenantId, id);
}

export async function softDeleteArticle(tenantId: string, id: string) {
  return articleRepo.softDeleteArticle(tenantId, id);
}

export async function findSimilarChunks(
  tenantId: string,
  embedding: number[],
  limit: number,
) {
  return chunkRepo.findSimilarChunks(tenantId, embedding, limit);
}

async function rechunkArticle(articleId: string, tenantId: string, text: string) {
  await chunkRepo.deleteChunksByArticleId(articleId);
  const chunks = await chunkText(text);
  if (chunks.length > 0) {
    await chunkRepo.createChunks(articleId, tenantId, chunks);
  }
  logger.info('Article chunked', { articleId, chunkCount: chunks.length });
}
