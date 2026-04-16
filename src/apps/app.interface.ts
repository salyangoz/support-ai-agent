// --- Normalized data models (shared across all apps) ---

export interface NormalizedTicket {
  externalId: string;
  subject?: string;
  initialBody?: string;
  state: string;
  language?: string;
  assigneeId?: string;
  customerEmail?: string;
  customerName?: string;
  customerExternalId?: string;
  externalCreatedAt?: Date;
  externalUpdatedAt?: Date;
}

export interface NormalizedAttachment {
  externalId?: string;
  fileName: string;
  fileType?: string;
  fileSize?: number;
  url: string;
}

export interface NormalizedMessage {
  externalId: string;
  authorRole: 'customer' | 'agent' | 'bot' | 'system';
  authorId?: string;
  authorName?: string;
  body: string;
  attachments?: NormalizedAttachment[];
  externalCreatedAt?: Date;
}

export interface WebhookEventData {
  state?: string;
  subject?: string;
  customerEmail?: string;
  customerName?: string;
  customerExternalId?: string;
  assigneeId?: string;
  latestMessageBody?: string;
  latestMessageExternalId?: string;
  latestMessageAuthorId?: string;
  latestMessageAuthorName?: string;
  latestMessageAuthorType?: string;
  latestMessageAttachments?: NormalizedAttachment[];
  createdAt?: number;
}

export interface WebhookEvent {
  type: 'new_ticket' | 'new_customer_reply' | 'ticket_closed' | 'ticket_assigned';
  ticketExternalId: string;
  data: WebhookEventData;
}

export type WebhookEventHandler = (
  tenant: import('../models/types').Tenant,
  app: import('../models/types').App,
  event: WebhookEvent,
) => Promise<void>;

// --- Ticket App interfaces ---

export interface InputApp {
  fetchRecentTickets(sinceMinutes: number): Promise<NormalizedTicket[]>;
  fetchTicketMessages(externalTicketId: string): Promise<NormalizedMessage[]>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): boolean;
  parseWebhook(rawBody: Buffer, headers: Record<string, any>): WebhookEvent | null;
}

export interface OutputApp {
  sendReply(externalTicketId: string, body: string, options?: SendReplyOptions): Promise<void>;
}

export interface DualApp extends InputApp, OutputApp {}

export interface SendReplyOptions {
  adminId?: string;
  metadata?: Record<string, any>;
}

// --- Knowledge App interfaces ---

export interface KnowledgeSourceApp {
  fetchArticles(since?: Date): Promise<NormalizedArticle[]>;
}

export interface NormalizedArticle {
  externalId: string;
  title: string;
  content: string;
  category?: string;
  metadata?: Record<string, any>;
}
