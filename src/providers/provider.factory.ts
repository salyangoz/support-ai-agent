import { TicketProvider } from './provider.interface';
import { IntercomAdapter } from './intercom/intercom.adapter';
import { ZendeskAdapter } from './zendesk/zendesk.adapter';

export function createProvider(credentials: Record<string, any>): TicketProvider {
  const provider = credentials.provider || credentials.providerName;

  switch (provider) {
    case 'intercom':
      return new IntercomAdapter({
        accessToken: credentials.accessToken,
        clientSecret: credentials.clientSecret,
      });
    case 'zendesk':
      return new ZendeskAdapter(credentials);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
