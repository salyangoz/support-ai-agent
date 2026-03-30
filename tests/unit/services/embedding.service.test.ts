import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

vi.mock('axios');

describe('EmbeddingService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('should return vector on success', async () => {
    const mockVector = Array(1536).fill(0.1);
    vi.mocked(axios.post).mockResolvedValue({ data: { vector: mockVector } });

    const { embed } = await import('../../../src/services/embedding.service');
    const result = await embed('test text');
    expect(result).toEqual(mockVector);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringContaining('/embed'),
      { text: 'test text' },
      expect.objectContaining({ timeout: 10000 }),
    );
  });

  it('should return null on timeout', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('timeout'));

    const { embed } = await import('../../../src/services/embedding.service');
    const result = await embed('test text');
    expect(result).toBeNull();
  });

  it('should return null on 500 error', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { status: 500 } });

    const { embed } = await import('../../../src/services/embedding.service');
    const result = await embed('test text');
    expect(result).toBeNull();
  });
});
