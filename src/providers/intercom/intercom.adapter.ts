import axios, { AxiosInstance } from 'axios';
import { TicketProvider, NormalizedTicket, NormalizedMessage, WebhookEvent } from '../provider.interface';
import { mapConversationToTicket, mapConversationPartsToMessages, mapInitialMessageToNormalized } from './intercom.mapper';
import { verifyIntercomWebhook, parseIntercomWebhook } from './intercom.webhook';
import { logger } from '../../utils/logger';

export interface IntercomCredentials {
  accessToken: string;
  clientSecret: string;
}

export class IntercomAdapter implements TicketProvider {
  private client: AxiosInstance;
  private credentials: IntercomCredentials;

  constructor(credentials: IntercomCredentials) {
    this.credentials = credentials;
    this.client = axios.create({
      baseURL: 'https://api.intercom.io',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
        'Intercom-Version': '2.11',
      },
      timeout: 15000,
    });
  }

  async fetchRecentTickets(sinceMinutes: number): Promise<NormalizedTicket[]> {
    const sinceTimestamp = Math.floor((Date.now() - sinceMinutes * 60 * 1000) / 1000);

    try {
      const response = await this.client.post('/conversations/search', {
        query: {
          operator: 'AND',
          value: [
            {
              field: 'updated_at',
              operator: '>',
              value: sinceTimestamp,
            },
          ],
        },
        pagination: { per_page: 50 },
      });

      const conversations = response.data.conversations || [];
      return conversations.map(mapConversationToTicket);
    } catch (err) {
      logger.error('Failed to fetch Intercom conversations', err);
      throw err;
    }
  }

  async fetchTicketMessages(externalTicketId: string): Promise<NormalizedMessage[]> {
    try {
      const response = await this.client.get(`/conversations/${externalTicketId}`);
      const conversation = response.data;

      const messages: NormalizedMessage[] = [];

      const initial = mapInitialMessageToNormalized(conversation);
      if (initial) {
        messages.push(initial);
      }

      const parts = conversation.conversation_parts?.conversation_parts || [];
      messages.push(...mapConversationPartsToMessages(parts));

      return messages;
    } catch (err) {
      logger.error(`Failed to fetch messages for conversation ${externalTicketId}`, err);
      throw err;
    }
  }

  async sendReply(
    externalTicketId: string,
    body: string,
    adminId?: string,
  ): Promise<void> {
    try {
      await this.client.post(`/conversations/${externalTicketId}/reply`, {
        message_type: 'comment',
        type: 'admin',
        admin_id: adminId || 'default',
        body,
      });
    } catch (err) {
      logger.error(`Failed to send reply to conversation ${externalTicketId}`, err);
      throw err;
    }
  }

  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): boolean {
    return verifyIntercomWebhook(rawBody, headers, this.credentials.clientSecret);
  }

  parseWebhook(rawBody: Buffer): WebhookEvent | null {
    try {
      const payload = JSON.parse(rawBody.toString());
      return parseIntercomWebhook(payload);
    } catch (err) {
      logger.error('Failed to parse Intercom webhook', err);
      return null;
    }
  }
}
