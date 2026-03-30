import { getPool } from '../database/pool';

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
  const pool = getPool();
  const conditions: string[] = ['tenant_id = $1'];
  const values: unknown[] = [tenantId];
  let paramIndex = 2;

  if (opts?.category) {
    conditions.push(`category = $${paramIndex++}`);
    values.push(opts.category);
  }

  if (opts?.search) {
    conditions.push(`(title ILIKE $${paramIndex} OR content ILIKE $${paramIndex})`);
    paramIndex++;
    values.push(`%${opts.search}%`);
  }

  if (opts?.isActive !== undefined) {
    conditions.push(`is_active = $${paramIndex++}`);
    values.push(opts.isActive);
  }

  const page = opts?.page ?? 1;
  const limit = opts?.limit ?? 20;
  const offset = (page - 1) * limit;

  values.push(limit);
  values.push(offset);

  const result = await pool.query(
    `SELECT * FROM knowledge_articles
     WHERE ${conditions.join(' AND ')}
     ORDER BY created_at DESC
     LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
    values,
  );
  return result.rows;
}

export async function findArticleById(tenantId: number, id: number) {
  const pool = getPool();
  const result = await pool.query(
    'SELECT * FROM knowledge_articles WHERE tenant_id = $1 AND id = $2',
    [tenantId, id],
  );
  return result.rows[0] || null;
}

export async function createArticle(data: {
  tenantId: number;
  title: string;
  content: string;
  category?: string;
  language?: string;
  embedding?: number[];
}) {
  const pool = getPool();
  const embeddingValue = data.embedding ? formatEmbedding(data.embedding) : null;
  const result = await pool.query(
    `INSERT INTO knowledge_articles (tenant_id, title, content, category, language, embedding)
     VALUES ($1, $2, $3, $4, $5, $6::vector)
     RETURNING *`,
    [
      data.tenantId,
      data.title,
      data.content,
      data.category || null,
      data.language || null,
      embeddingValue,
    ],
  );
  return result.rows[0];
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
  const pool = getPool();
  const setClauses: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (data.title !== undefined) {
    setClauses.push(`title = $${paramIndex++}`);
    values.push(data.title);
  }

  if (data.content !== undefined) {
    setClauses.push(`content = $${paramIndex++}`);
    values.push(data.content);
  }

  if (data.category !== undefined) {
    setClauses.push(`category = $${paramIndex++}`);
    values.push(data.category);
  }

  if (data.language !== undefined) {
    setClauses.push(`language = $${paramIndex++}`);
    values.push(data.language);
  }

  if (data.embedding !== undefined) {
    setClauses.push(`embedding = $${paramIndex++}::vector`);
    values.push(formatEmbedding(data.embedding));
  }

  if (setClauses.length === 0) {
    return findArticleById(tenantId, id);
  }

  setClauses.push(`updated_at = NOW()`);
  values.push(tenantId);
  values.push(id);

  const result = await pool.query(
    `UPDATE knowledge_articles SET ${setClauses.join(', ')}
     WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex}
     RETURNING *`,
    values,
  );
  return result.rows[0] || null;
}

export async function softDeleteArticle(tenantId: number, id: number) {
  const pool = getPool();
  const result = await pool.query(
    `UPDATE knowledge_articles SET is_active = false, updated_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, id],
  );
  return result.rows[0] || null;
}

export async function findSimilarArticles(
  tenantId: number,
  embedding: number[],
  limit: number,
) {
  const pool = getPool();
  const result = await pool.query(
    `SELECT id, title, content
     FROM knowledge_articles
     WHERE tenant_id = $1 AND is_active = true
     ORDER BY embedding <=> $2::vector
     LIMIT $3`,
    [tenantId, formatEmbedding(embedding), limit],
  );
  return result.rows;
}
