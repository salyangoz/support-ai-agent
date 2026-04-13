import { NormalizedTicket, NormalizedMessage } from '../app.interface';
import { IntercomConversation, IntercomConversationPart } from './intercom.types';
import { htmlToText } from '../../utils/htmlToText';

export function mapConversationToTicket(conversation: IntercomConversation): NormalizedTicket {
  const contact = conversation.contacts?.contacts?.[0] || conversation.user;

  const ticket: NormalizedTicket = {
    externalId: String(conversation.id),
    state: conversation.state || 'open',
    externalCreatedAt: conversation.created_at
      ? new Date(conversation.created_at * 1000)
      : undefined,
    externalUpdatedAt: conversation.updated_at
      ? new Date(conversation.updated_at * 1000)
      : undefined,
  };

  if (conversation.title) {
    ticket.subject = conversation.title;
  }

  if (conversation.source?.body) {
    ticket.initialBody = htmlToText(conversation.source.body);
  }

  if (conversation.assignee?.id) {
    ticket.assigneeId = String(conversation.assignee.id);
  }

  if (contact) {
    ticket.customerEmail = contact.email;
    ticket.customerName = contact.name;
    ticket.customerExternalId = String(contact.id);
  }

  return ticket;
}

function mapAuthorRole(type: string): NormalizedMessage['authorRole'] {
  switch (type) {
    case 'admin': return 'agent';
    case 'bot': return 'bot';
    case 'user':
    case 'lead':
    case 'contact':
      return 'customer';
    default: return 'system';
  }
}

export function mapConversationPartsToMessages(
  parts: IntercomConversationPart[],
): NormalizedMessage[] {
  return parts
    .filter(part => part.body)
    .map(part => ({
      externalId: String(part.id),
      authorRole: mapAuthorRole(part.author?.type),
      authorId: part.author?.id ? String(part.author.id) : undefined,
      authorName: part.author?.name,
      body: htmlToText(part.body),
      externalCreatedAt: part.created_at
        ? new Date(part.created_at * 1000)
        : undefined,
    }));
}

export function mapInitialMessageToNormalized(
  conversation: IntercomConversation,
): NormalizedMessage | null {
  const source = conversation.source || conversation.conversation_message;
  if (!source?.body) {
    return null;
  }

  return {
    externalId: `${conversation.id}-initial`,
    authorRole: mapAuthorRole(source.author?.type || 'user'),
    authorId: source.author?.id ? String(source.author.id) : undefined,
    authorName: (source.author as any)?.name,
    body: htmlToText(source.body),
    externalCreatedAt: conversation.created_at
      ? new Date(conversation.created_at * 1000)
      : undefined,
  };
}
