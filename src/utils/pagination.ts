export interface PaginationParams {
  cursor?: string;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore: boolean;
    total: number;
  };
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export function parsePaginationQuery(query: Record<string, unknown>): PaginationParams {
  const cursor = typeof query.cursor === 'string' && query.cursor.length > 0
    ? query.cursor
    : undefined;

  let limit = DEFAULT_LIMIT;
  if (query.limit !== undefined) {
    const parsed = parseInt(query.limit as string, 10);
    if (!isNaN(parsed)) {
      limit = Math.max(1, Math.min(parsed, MAX_LIMIT));
    }
  }

  return { cursor, limit };
}

export function buildPaginatedResult<T extends { id: string }>(
  items: T[],
  total: number,
  limit: number,
): PaginatedResult<T> {
  const hasMore = items.length === limit;
  const nextCursor = hasMore ? items[items.length - 1].id : null;

  return {
    data: items,
    pagination: {
      nextCursor,
      hasMore,
      total,
    },
  };
}
