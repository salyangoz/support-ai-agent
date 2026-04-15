import { describe, it, expect } from 'vitest';
import { parsePaginationQuery, buildPaginatedResult } from '../../../src/utils/pagination';

describe('parsePaginationQuery', () => {
  it('should return defaults when no params provided', () => {
    const result = parsePaginationQuery({});
    expect(result).toEqual({ cursor: undefined, limit: 20 });
  });

  it('should parse cursor and limit', () => {
    const result = parsePaginationQuery({
      cursor: '019d8e23-ccd1-74ac-99c5-6a05d04643df',
      limit: '10',
    });
    expect(result.cursor).toBe('019d8e23-ccd1-74ac-99c5-6a05d04643df');
    expect(result.limit).toBe(10);
  });

  it('should clamp limit to max 100', () => {
    const result = parsePaginationQuery({ limit: '500' });
    expect(result.limit).toBe(100);
  });

  it('should clamp limit to min 1', () => {
    const result = parsePaginationQuery({ limit: '0' });
    expect(result.limit).toBe(1);
  });

  it('should ignore empty cursor string', () => {
    const result = parsePaginationQuery({ cursor: '' });
    expect(result.cursor).toBeUndefined();
  });

  it('should ignore invalid limit', () => {
    const result = parsePaginationQuery({ limit: 'abc' });
    expect(result.limit).toBe(20);
  });
});

describe('buildPaginatedResult', () => {
  it('should set hasMore=true when items.length equals limit', () => {
    const items = [{ id: 'a' }, { id: 'b' }];
    const result = buildPaginatedResult(items, 5, 2);

    expect(result.pagination.hasMore).toBe(true);
    expect(result.pagination.nextCursor).toBe('b');
    expect(result.pagination.total).toBe(5);
    expect(result.data).toEqual(items);
  });

  it('should set hasMore=false when items.length is less than limit', () => {
    const items = [{ id: 'a' }];
    const result = buildPaginatedResult(items, 1, 10);

    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
    expect(result.pagination.total).toBe(1);
  });

  it('should handle empty results', () => {
    const result = buildPaginatedResult([], 0, 20);

    expect(result.data).toEqual([]);
    expect(result.pagination.hasMore).toBe(false);
    expect(result.pagination.nextCursor).toBeNull();
    expect(result.pagination.total).toBe(0);
  });
});
