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

export interface NormalizedMessage {
  externalId: string;
  authorRole: 'customer' | 'agent' | 'bot' | 'system';
  authorId?: string;
  authorName?: string;
  body: string;
  externalCreatedAt?: Date;
}

export interface WebhookEvent {
  type: 'new_ticket' | 'new_customer_reply' | 'ticket_closed' | 'ticket_assigned';
  ticketExternalId: string;
  data: Record<string, any>;
}

export interface TicketProvider {
  fetchRecentTickets(sinceMinutes: number): Promise<NormalizedTicket[]>;
  fetchTicketMessages(externalTicketId: string): Promise<NormalizedMessage[]>;
  sendReply(externalTicketId: string, body: string, adminId?: string): Promise<void>;
  verifyWebhook(rawBody: Buffer, headers: Record<string, any>): boolean;
  parseWebhook(rawBody: Buffer, headers: Record<string, any>): WebhookEvent | null;
}
