import * as articleRepo from '../repositories/knowledgeArticle.repository';
import * as chunkRepo from '../repositories/knowledgeChunk.repository';
import * as tenantRepo from '../repositories/tenant.repository';
import { chunkText } from './chunking.service';
import { embed } from './embedding.service';
import { logger } from '../utils/logger';

export async function getArticles(
  tenantId: string,
  opts?: {
    category?: string;
    search?: string;
    isActive?: boolean;
    cursor?: string;
    limit?: number;
    page?: number;
  },
) {
  const result = await articleRepo.findArticlesByTenantId(tenantId, opts);
  const articleIds = result.data.map((a: any) => a.id);
  const embeddingStatus = await chunkRepo.getEmbeddingStatusByArticleIds(articleIds);

  const enriched = result.data.map((article: any) => {
    const status = embeddingStatus[article.id];
    return {
      ...article,
      embeddingStatus: status
        ? { totalChunks: status.totalChunks, embeddedChunks: status.embeddedChunks }
        : { totalChunks: 0, embeddedChunks: 0 },
    };
  });

  return { ...result, data: enriched };
}

export async function getArticle(tenantId: string, id: string) {
  return getArticleById(tenantId, id);
}

export async function getArticleById(tenantId: string, id: string) {
  const article = await articleRepo.findArticleById(tenantId, id);
  if (!article) return null;

  const status = await chunkRepo.getEmbeddingStatusByArticleIds([article.id]);
  const s = status[article.id];
  return {
    ...article,
    embeddingStatus: s
      ? { totalChunks: s.totalChunks, embeddedChunks: s.embeddedChunks }
      : { totalChunks: 0, embeddedChunks: 0 },
  };
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

export async function embedArticle(
  tenantId: string,
  articleId: string,
  opts?: { credentials?: { api_key?: string }; service?: string; model?: string },
) {
  const article = await articleRepo.findArticleById(tenantId, articleId);
  if (!article) return null;

  const chunks = await chunkRepo.findChunksWithoutEmbedding(tenantId);
  const articleChunks = chunks.filter((c: any) => c.article_id === articleId || c.articleId === articleId);

  let embedded = 0;
  let failed = 0;

  for (const chunk of articleChunks) {
    const embedding = await embed(chunk.content, opts?.credentials, opts?.service, opts?.model);
    if (embedding) {
      await chunkRepo.updateChunkEmbedding(chunk.id, embedding);
      embedded++;
    } else {
      failed++;
    }
  }

  const status = await chunkRepo.getEmbeddingStatusByArticleIds([articleId]);
  const s = status[articleId];

  return {
    articleId,
    processed: embedded,
    failed,
    embeddingStatus: s
      ? { totalChunks: s.totalChunks, embeddedChunks: s.embeddedChunks }
      : { totalChunks: 0, embeddedChunks: 0 },
  };
}

export async function embedAllArticles(tenantId: string, credentials?: { api_key?: string }) {
  const chunks = await chunkRepo.findChunksWithoutEmbedding(tenantId);

  let embedded = 0;
  let failed = 0;

  for (const chunk of chunks) {
    const embedding = await embed(chunk.content, credentials);
    if (embedding) {
      await chunkRepo.updateChunkEmbedding(chunk.id, embedding);
      embedded++;
    } else {
      failed++;
    }
  }

  return { processed: embedded, failed, pending: 0 };
}

async function rechunkArticle(articleId: string, tenantId: string, text: string) {
  await chunkRepo.deleteChunksByArticleId(articleId);
  const chunks = await chunkText(text);
  if (chunks.length > 0) {
    await chunkRepo.createChunks(articleId, tenantId, chunks);
  }
  logger.info('Article chunked', { articleId, chunkCount: chunks.length });
}
