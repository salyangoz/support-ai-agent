export interface Tenant {
  id: number;
  name: string;
  slug: string;
  apiKey: string;
  settings: TenantSettings;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantSettings {
  auto_send_drafts?: boolean;
  default_language?: string;
  rag_top_k?: number;
  embedding_dimension?: number;
  ai_service?: string;
  ai_model?: string;
  ai_instructions?: string;
  draft_tone?: string;
  max_context_tokens?: number;
  sync_lookback_minutes?: number;
}

export interface TenantProvider {
  id: number;
  tenantId: number;
  provider: string;
  credentials: Record<string, any>;
  webhookSecret: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: number;
  tenantId: number;
  externalId: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: number;
  tenantId: number;
  customerId: number | null;
  provider: string;
  externalId: string;
  state: string;
  subject: string | null;
  initialBody: string | null;
  language: string | null;
  assigneeId: string | null;
  externalCreatedAt: Date | null;
  externalUpdatedAt: Date | null;
  syncedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  customer?: Customer;
}

export interface Message {
  id: number;
  ticketId: number;
  tenantId: number;
  externalId: string;
  authorRole: string;
  authorId: string | null;
  authorName: string | null;
  body: string | null;
  embedding: number[] | null;
  externalCreatedAt: Date | null;
  createdAt: Date;
}

export interface KnowledgeArticle {
  id: number;
  tenantId: number;
  title: string;
  content: string;
  category: string | null;
  language: string | null;
  embedding: number[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Draft {
  id: number;
  ticketId: number;
  tenantId: number;
  promptContext: string | null;
  draftResponse: string;
  aiModel: string | null;
  aiTokensUsed: number | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}
