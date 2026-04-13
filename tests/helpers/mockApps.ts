import {
  InputApp,
  OutputApp,
  NormalizedTicket,
  NormalizedMessage,
  WebhookEvent,
  SendReplyOptions,
} from '../../src/apps/app.interface';

export class MockIntercomInputApp implements InputApp {
  public ticketsToReturn: NormalizedTicket[] = [];
  public messagesToReturn: NormalizedMessage[] = [];
  public webhookEventToReturn: WebhookEvent | null = null;
  public webhookVerifyResult = true;

  async fetchRecentTickets(): Promise<NormalizedTicket[]> {
    return this.ticketsToReturn;
  }

  async fetchTicketMessages(): Promise<NormalizedMessage[]> {
    return this.messagesToReturn;
  }

  verifyWebhook(): boolean {
    return this.webhookVerifyResult;
  }

  parseWebhook(): WebhookEvent | null {
    return this.webhookEventToReturn;
  }
}

export class MockIntercomOutputApp implements OutputApp {
  public sentReplies: Array<{ externalTicketId: string; body: string; options?: SendReplyOptions }> = [];

  async sendReply(externalTicketId: string, body: string, options?: SendReplyOptions): Promise<void> {
    this.sentReplies.push({ externalTicketId, body, options });
  }
}

export function createMockTicket(overrides: Partial<NormalizedTicket> = {}): NormalizedTicket {
  return {
    externalId: 'conv-123',
    subject: 'Test ticket',
    initialBody: 'I need help with my order',
    state: 'open',
    customerEmail: 'jane@example.com',
    customerName: 'Jane Doe',
    customerExternalId: 'user-456',
    externalCreatedAt: new Date('2026-03-01'),
    externalUpdatedAt: new Date('2026-03-01'),
    ...overrides,
  };
}

export function createMockMessage(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    externalId: 'msg-789',
    authorRole: 'customer',
    authorId: 'user-456',
    authorName: 'Jane Doe',
    body: 'I need help with my order',
    externalCreatedAt: new Date('2026-03-01'),
    ...overrides,
  };
}
