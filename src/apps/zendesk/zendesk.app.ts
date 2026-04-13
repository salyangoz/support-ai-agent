import { InputApp, OutputApp, NormalizedTicket, NormalizedMessage, WebhookEvent, SendReplyOptions } from '../app.interface';

export class ZendeskInputApp implements InputApp {
  constructor(_credentials: Record<string, any>) {
    // Placeholder
  }

  async fetchRecentTickets(): Promise<NormalizedTicket[]> {
    throw new Error('Zendesk app not yet implemented');
  }

  async fetchTicketMessages(): Promise<NormalizedMessage[]> {
    throw new Error('Zendesk app not yet implemented');
  }

  verifyWebhook(): boolean {
    throw new Error('Zendesk app not yet implemented');
  }

  parseWebhook(): WebhookEvent | null {
    throw new Error('Zendesk app not yet implemented');
  }
}

export class ZendeskOutputApp implements OutputApp {
  constructor(_credentials: Record<string, any>) {
    // Placeholder
  }

  async sendReply(_externalTicketId: string, _body: string, _options?: SendReplyOptions): Promise<void> {
    throw new Error('Zendesk app not yet implemented');
  }
}
