import { AxiosInstance } from 'axios';
import { InputApp, OutputApp, NormalizedTicket, NormalizedMessage, WebhookEvent, SendReplyOptions, SendReplyResult } from '../app.interface';
import { createIntercomClient } from './intercom.http';
import { mapConversationToTicket, mapConversationPartsToMessages, mapInitialMessageToNormalized } from './intercom.mapper';
import { verifyIntercomWebhook, parseIntercomWebhook } from './intercom.webhook';
import { logger } from '../../utils/logger';

export interface IntercomCredentials {
  accessToken: string;
  clientSecret: string;
}

export class IntercomInputApp implements InputApp {
  private client: AxiosInstance;
  private credentials: IntercomCredentials;

  constructor(credentials: IntercomCredentials) {
    this.credentials = credentials;
    this.client = createIntercomClient(credentials.accessToken);
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
      const tickets: NormalizedTicket[] = [];

      for (const conv of conversations) {
        try {
          const detail = await this.client.get(`/conversations/${conv.id}`);
          const conversation = detail.data;

          // Intercom returns minimal contact refs — fetch full contact for email/name
          const contactRef = conversation.contacts?.contacts?.[0];
          if (contactRef?.id && !contactRef.email) {
            try {
              const contactDetail = await this.client.get(`/contacts/${contactRef.id}`);
              const full = contactDetail.data;
              conversation.contacts.contacts[0] = {
                ...contactRef,
                email: full.email,
                name: full.name,
              };
              logger.info('Fetched contact detail', {
                contactId: contactRef.id,
                email: full.email,
                name: full.name,
              });
            } catch (contactErr) {
              logger.error('Failed to fetch contact detail', {
                contactId: contactRef.id,
                error: (contactErr as Error).message,
              });
            }
          }

          tickets.push(mapConversationToTicket(conversation));
        } catch (err) {
          logger.error('Failed to fetch conversation detail, using search data', {
            conversationId: conv.id,
            error: (err as Error).message,
          });
          tickets.push(mapConversationToTicket(conv));
        }
      }

      return tickets;
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

      // Log attachment data for debugging
      const partsWithAttachments = parts.filter((p: any) => p.attachments?.length > 0);
      if (partsWithAttachments.length > 0) {
        logger.info('Intercom attachments found', {
          conversationId: externalTicketId,
          count: partsWithAttachments.reduce((sum: number, p: any) => sum + p.attachments.length, 0),
        });
      }

      // Also check source/initial message for attachments
      const sourceAttachments = conversation.source?.attachments || [];
      if (sourceAttachments.length > 0) {
        logger.info('Intercom source attachments found', {
          conversationId: externalTicketId,
          count: sourceAttachments.length,
        });
      }

      messages.push(...mapConversationPartsToMessages(parts));

      return messages;
    } catch (err) {
      logger.error(`Failed to fetch messages for conversation ${externalTicketId}`, err);
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

export class IntercomOutputApp implements OutputApp {
  private client: AxiosInstance;
  private sendAsNote: boolean;
  private defaultAdminId?: string;

  constructor(credentials: Pick<IntercomCredentials, 'accessToken'>, config?: { sendAsNote?: boolean; adminId?: string }) {
    this.client = createIntercomClient(credentials.accessToken);
    this.sendAsNote = config?.sendAsNote ?? false;
    this.defaultAdminId = config?.adminId;
  }

  isNoteMode(): boolean {
    return this.sendAsNote;
  }

  async sendReply(
    externalTicketId: string,
    body: string,
    options?: SendReplyOptions,
  ): Promise<SendReplyResult> {
    const adminId = options?.adminId || this.defaultAdminId;
    if (!adminId) {
      throw new Error('Intercom admin_id is required. Set it in app config or pass via options.');
    }

    try {
      const { data } = await this.client.post(`/conversations/${externalTicketId}/reply`, {
        message_type: this.sendAsNote ? 'note' : 'comment',
        type: 'admin',
        admin_id: adminId,
        body,
      });

      // Pick only the part authored by THIS admin with the message_type we
      // just posted. Picking parts[-1] would be racy under concurrent writes
      // and could later cause us to redact another admin's note. If nothing
      // matches we return undefined so no id is stored, which makes the
      // redact-previous-note step skip entirely — safe by default.
      const expectedPartType = this.sendAsNote ? 'note' : 'comment';
      const parts: Array<Record<string, any>> = data?.conversation_parts?.conversation_parts ?? [];
      const ours = parts.filter((p) =>
        String(p?.author?.id ?? '') === String(adminId) &&
        p?.author?.type === 'admin' &&
        (!p?.part_type || p.part_type === expectedPartType)
      );
      const latest = ours.length > 0
        ? ours.reduce((a, b) => ((a?.created_at ?? 0) >= (b?.created_at ?? 0) ? a : b))
        : null;

      return { externalMessageId: latest?.id ? String(latest.id) : undefined };
    } catch (err: any) {
      const detail = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err?.message;
      throw new Error(
        `Intercom reply failed (${err?.response?.status}): ${detail}`,
      );
    }
  }

  async redactPart(externalTicketId: string, externalMessageId: string): Promise<void> {
    try {
      await this.client.post('/conversations/redact', {
        type: 'conversation_part',
        conversation_id: externalTicketId,
        conversation_part_id: externalMessageId,
      });
    } catch (err: any) {
      const detail = err?.response?.data
        ? JSON.stringify(err.response.data)
        : err?.message;
      throw new Error(
        `Intercom redact failed (${err?.response?.status}): ${detail}`,
      );
    }
  }
}
