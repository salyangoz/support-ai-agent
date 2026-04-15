import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SlackKbApp } from '../../../src/apps/slack-kb/slack-kb.app';

vi.mock('axios', () => ({
  default: {
    create: vi.fn(),
  },
}));

vi.mock('../../../src/lib/yengec-ai', () => ({
  chat: vi.fn().mockResolvedValue({
    text: 'Title: How to reset API keys\n\nContent: When a customer needs to reset their API key, go to Settings > API Keys > Regenerate. The old key is invalidated immediately.',
    tokensUsed: 100,
  }),
}));

import axios from 'axios';

const mockGet = vi.fn();

describe('SlackKbApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(axios.create).mockReturnValue({ get: mockGet } as any);
  });

  it('should fetch and summarize threads from channels', async () => {
    // conversations.info
    mockGet.mockResolvedValueOnce({
      data: { ok: true, channel: { name: 'support-internal' } },
    });

    // conversations.history
    mockGet.mockResolvedValueOnce({
      data: {
        ok: true,
        messages: [
          { ts: '1700000000.000100', text: 'How do we reset API keys?', reply_count: 3 },
          { ts: '1700000000.000200', text: 'Quick note', reply_count: 0 },
        ],
      },
    });

    // conversations.replies for the thread with enough replies
    mockGet.mockResolvedValueOnce({
      data: {
        ok: true,
        messages: [
          { user: 'U1', text: 'How do we reset API keys?', ts: '1700000000.000100' },
          { user: 'U2', text: 'Go to Settings > API Keys', ts: '1700000000.000101' },
          { user: 'U3', text: 'Thanks, that worked!', ts: '1700000000.000102' },
        ],
      },
    });

    const app = new SlackKbApp({
      botToken: 'xoxb-test',
      channelIds: ['C01ABC'],
      minReplies: 2,
    });

    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(1);
    expect(articles[0].externalId).toBe('slack:C01ABC:1700000000.000100');
    expect(articles[0].title).toBe('How to reset API keys');
    expect(articles[0].category).toBe('support-internal');
    expect(articles[0].content).toContain('Settings > API Keys');
  });

  it('should skip threads with too few replies', async () => {
    mockGet.mockResolvedValueOnce({
      data: { ok: true, channel: { name: 'general' } },
    });

    mockGet.mockResolvedValueOnce({
      data: {
        ok: true,
        messages: [
          { ts: '1700000000.000100', text: 'Short thread', reply_count: 1 },
        ],
      },
    });

    const app = new SlackKbApp({
      botToken: 'xoxb-test',
      channelIds: ['C01ABC'],
      minReplies: 2,
    });

    const articles = await app.fetchArticles();
    expect(articles).toHaveLength(0);
  });

  it('should process multiple channels', async () => {
    // Channel 1
    mockGet.mockResolvedValueOnce({ data: { ok: true, channel: { name: 'ch1' } } });
    mockGet.mockResolvedValueOnce({
      data: { ok: true, messages: [{ ts: '1.1', text: 'Thread 1', reply_count: 3 }] },
    });
    mockGet.mockResolvedValueOnce({
      data: { ok: true, messages: [
        { user: 'U1', text: 'Q1', ts: '1.1' },
        { user: 'U2', text: 'A1', ts: '1.2' },
        { user: 'U3', text: 'Thanks', ts: '1.3' },
      ] },
    });

    // Channel 2
    mockGet.mockResolvedValueOnce({ data: { ok: true, channel: { name: 'ch2' } } });
    mockGet.mockResolvedValueOnce({
      data: { ok: true, messages: [{ ts: '2.1', text: 'Thread 2', reply_count: 3 }] },
    });
    mockGet.mockResolvedValueOnce({
      data: { ok: true, messages: [
        { user: 'U4', text: 'Q2', ts: '2.1' },
        { user: 'U5', text: 'A2', ts: '2.2' },
        { user: 'U6', text: 'OK', ts: '2.3' },
      ] },
    });

    const app = new SlackKbApp({
      botToken: 'xoxb-test',
      channelIds: ['C01', 'C02'],
      minReplies: 2,
    });

    const articles = await app.fetchArticles();

    expect(articles).toHaveLength(2);
    expect(articles[0].category).toBe('ch1');
    expect(articles[1].category).toBe('ch2');
  });
});
