export interface Tenant {
  id: number;
  name: string;
  slug: string;
  api_key: string;
  settings: TenantSettings;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
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
  tenant_id: number;
  provider: string;
  credentials: Record<string, any>;
  webhook_secret: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Customer {
  id: number;
  tenant_id: number;
  external_id: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface Ticket {
  id: number;
  tenant_id: number;
  customer_id: number | null;
  provider: string;
  external_id: string;
  state: string;
  subject: string | null;
  initial_body: string | null;
  language: string | null;
  assignee_id: string | null;
  external_created_at: Date | null;
  external_updated_at: Date | null;
  synced_at: Date;
  created_at: Date;
  updated_at: Date;
  // Joined fields
  customer?: Customer;
}

export interface Message {
  id: number;
  ticket_id: number;
  tenant_id: number;
  external_id: string;
  author_role: string;
  author_id: string | null;
  author_name: string | null;
  body: string | null;
  embedding: number[] | null;
  external_created_at: Date | null;
  created_at: Date;
}

export interface KnowledgeArticle {
  id: number;
  tenant_id: number;
  title: string;
  content: string;
  category: string | null;
  language: string | null;
  embedding: number[] | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Draft {
  id: number;
  ticket_id: number;
  tenant_id: number;
  prompt_context: string | null;
  draft_response: string;
  ai_model: string | null;
  ai_tokens_used: number | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
}
