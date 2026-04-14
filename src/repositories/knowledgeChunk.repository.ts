import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';

function formatEmbedding(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

export async function deleteChunksByArticleId(articleId: string) {
  return getPrisma().knowledgeChunk.deleteMany({
    where: { articleId },
  });
}

export async function createChunks(
  articleId: string,
  tenantId: string,
  chunks: string[],
) {
  const data = chunks.map((content, index) => ({
    id: generateId(),
    articleId,
    tenantId,
    chunkIndex: index,
    content,
  }));

  return getPrisma().knowledgeChunk.createMany({ data });
}

export async function findChunksWithoutEmbedding(tenantId: string) {
  return getPrisma().$queryRawUnsafe<
    { id: string; content: string }[]
  >(
    `SELECT id, content
     FROM knowledge_chunks
     WHERE tenant_id = $1 AND embedding IS NULL`,
    tenantId,
  );
}

export async function updateChunkEmbedding(id: string, embedding: number[]) {
  const prisma = getPrisma();
  await prisma.$executeRawUnsafe(
    `UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2`,
    formatEmbedding(embedding),
    id,
  );
}

export async function findSimilarChunks(
  tenantId: string,
  embedding: number[],
  limit: number,
) {
  return getPrisma().$queryRawUnsafe<
    { id: string; article_id: string; content: string }[]
  >(
    `SELECT kc.id, kc.article_id, kc.content
     FROM knowledge_chunks kc
     JOIN knowledge_articles ka ON ka.id = kc.article_id
     WHERE kc.tenant_id = $1
       AND ka.is_active = true
       AND kc.embedding IS NOT NULL
     ORDER BY kc.embedding <=> $2::vector
     LIMIT $3`,
    tenantId,
    formatEmbedding(embedding),
    limit,
  );
}
