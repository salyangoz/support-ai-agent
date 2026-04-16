import axios, { AxiosInstance } from 'axios';
import { KnowledgeSourceApp, NormalizedArticle } from '../app.interface';
import { chat as yengecChat } from '../../lib/yengec-ai';
import { logger } from '../../utils/logger';

export interface SlackKbConfig {
  botToken: string;
  channelIds: string[];
  minReplies?: number;
  lookbackDays?: number;
  aiService?: string;
  aiModel?: string;
  aiCredentials?: { api_key?: string };
}

const DEFAULT_MIN_REPLIES = 2;
const DEFAULT_LOOKBACK_DAYS = 30;

export class SlackKbApp implements KnowledgeSourceApp {
  private client: AxiosInstance;
  private channelIds: string[];
  private minReplies: number;
  private lookbackDays: number;
  private aiService: string;
  private aiModel: string;
  private aiCredentials?: { api_key?: string };

  constructor(config: SlackKbConfig) {
    this.channelIds = config.channelIds;
    this.minReplies = config.minReplies ?? DEFAULT_MIN_REPLIES;
    this.lookbackDays = config.lookbackDays ?? DEFAULT_LOOKBACK_DAYS;
    this.aiService = config.aiService || 'deepseek';
    this.aiModel = config.aiModel || 'deepseek-chat';
    this.aiCredentials = config.aiCredentials;

    this.client = axios.create({
      baseURL: 'https://slack.com/api',
      headers: {
        Authorization: `Bearer ${config.botToken}`,
      },
      timeout: 15_000,
    });
  }

  async fetchArticles(since?: Date): Promise<NormalizedArticle[]> {
    const oldest = since
      ? String(since.getTime() / 1000)
      : String((Date.now() - this.lookbackDays * 86400 * 1000) / 1000);

    const articles: NormalizedArticle[] = [];

    for (const channelId of this.channelIds) {
      try {
        const channelName = await this.getChannelName(channelId);
        const threads = await this.getThreads(channelId, oldest);

        for (const thread of threads) {
          try {
            const replies = await this.getThreadReplies(channelId, thread.ts);

            if (replies.length < this.minReplies) continue;

            const conversation = replies
              .map((r: any) => `[${r.user || 'unknown'}]: ${r.text || ''}`)
              .join('\n');

            const summary = await this.summarize(conversation);
            if (!summary) continue;

            articles.push({
              externalId: `slack:${channelId}:${thread.ts}`,
              title: summary.title,
              content: summary.content,
              category: channelName,
              metadata: {
                source: 'slack',
                channelId,
                channelName,
                threadTs: thread.ts,
              },
            });
          } catch (err) {
            logger.error('Failed to process Slack thread', {
              channelId,
              threadTs: thread.ts,
              error: (err as Error).message,
            });
          }
        }
      } catch (err) {
        logger.error('Failed to fetch Slack channel', {
          channelId,
          error: (err as Error).message,
        });
      }
    }

    return articles;
  }

  private async getChannelName(channelId: string): Promise<string> {
    try {
      const res = await this.client.get('/conversations.info', {
        params: { channel: channelId },
      });
      return res.data?.channel?.name || channelId;
    } catch {
      return channelId;
    }
  }

  private async getThreads(channelId: string, oldest: string): Promise<any[]> {
    const res = await this.client.get('/conversations.history', {
      params: {
        channel: channelId,
        oldest,
        limit: 100,
      },
    });

    if (!res.data.ok) {
      throw new Error(res.data.error || 'Slack API error');
    }

    // Only messages that started threads
    return (res.data.messages || []).filter(
      (m: any) => m.reply_count && m.reply_count >= this.minReplies,
    );
  }

  private async getThreadReplies(channelId: string, threadTs: string): Promise<any[]> {
    const res = await this.client.get('/conversations.replies', {
      params: {
        channel: channelId,
        ts: threadTs,
        limit: 100,
      },
    });

    if (!res.data.ok) {
      throw new Error(res.data.error || 'Slack API error');
    }

    return res.data.messages || [];
  }

  private async summarize(conversation: string): Promise<{ title: string; content: string } | null> {
    try {
      const response = await yengecChat({
        service: this.aiService,
        model: this.aiModel,
        instructions: [
          'You are a knowledge base article generator.',
          'Summarize the following Slack thread into a knowledge base article.',
          'Write in the same language as the conversation.',
          'Format your response exactly as:\nTitle: (a clear, descriptive title)\n\nContent: (the key information, decisions, and outcomes from this thread)',
        ],
        question: conversation,
        credentials: this.aiCredentials,
      });

      const text = response.text;
      const titleMatch = text.match(/Title\s*:\s*(.+)/i);
      const contentMatch = text.match(/Content\s*:\s*([\s\S]+)/i);

      return {
        title: titleMatch?.[1]?.trim() || text.substring(0, 100),
        content: contentMatch?.[1]?.trim() || text,
      };
    } catch (err) {
      logger.error('Failed to summarize Slack thread', { error: (err as Error).message });
      return null;
    }
  }
}
