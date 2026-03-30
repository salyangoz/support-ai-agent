export interface IntercomConversation {
  id: string;
  state: string;
  title?: string;
  source?: {
    body: string | null;
    author: { type: string; id: string; email?: string; name?: string };
  };
  contacts?: {
    contacts: Array<{ id: string; email?: string; name?: string }>;
  };
  user?: { type: string; id: string; email?: string; name?: string };
  assignee?: { id: string; name?: string };
  conversation_parts?: {
    conversation_parts: IntercomConversationPart[];
  };
  conversation_message?: {
    body: string | null;
    author: { type: string; id: string; name?: string };
  };
  created_at: number;
  updated_at: number;
}

export interface IntercomConversationPart {
  id: string;
  part_type: string;
  body: string | null;
  author: { type: string; id: string; name?: string };
  created_at: number;
}

export interface IntercomWebhookPayload {
  type: string;
  id: string;
  topic: string;
  app_id: string;
  data: {
    type: string;
    item: IntercomConversation;
  };
  created_at: number;
}
