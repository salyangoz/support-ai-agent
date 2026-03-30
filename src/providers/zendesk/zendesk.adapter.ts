import { TicketProvider, NormalizedTicket, NormalizedMessage, WebhookEvent } from '../provider.interface';

export class ZendeskAdapter implements TicketProvider {
  constructor(_credentials: Record<string, any>) {
    // Placeholder
  }

  async fetchRecentTickets(): Promise<NormalizedTicket[]> {
    throw new Error('Zendesk adapter not yet implemented');
  }

  async fetchTicketMessages(): Promise<NormalizedMessage[]> {
    throw new Error('Zendesk adapter not yet implemented');
  }

  async sendReply(): Promise<void> {
    throw new Error('Zendesk adapter not yet implemented');
  }

  verifyWebhook(): boolean {
    throw new Error('Zendesk adapter not yet implemented');
  }

  parseWebhook(): WebhookEvent | null {
    throw new Error('Zendesk adapter not yet implemented');
  }
}
