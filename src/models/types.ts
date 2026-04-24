export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  name: string;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TenantUser {
  id: string;
  tenantId: string;
  userId: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Tenant {
  id: string;
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
  ai_service?: string;
  ai_model?: string;
  embedding_service?: string;
  embedding_model?: string;
  embedding_credentials?: {
    api_key?: string;
  };
  ai_credentials?: {
    api_key?: string;
  };
  ai_instructions?: string;
  draft_tone?: string;
  max_context_tokens?: number;
  sync_lookback_minutes?: number;
  draft_debounce_seconds?: number;
  output_app_ids?: string[];
  auto_generate_kb?: boolean;
}

export interface App {
  id: string;
  tenantId: string;
  code: string;
  type: string;
  role: string;
  name: string | null;
  credentials: Record<string, any>;
  webhookSecret: string | null;
  config: Record<string, any>;
  isActive: boolean;
  lastSyncedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Customer {
  id: string;
  tenantId: string;
  externalId: string | null;
  email: string | null;
  name: string | null;
  phone: string | null;
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Ticket {
  id: string;
  tenantId: string;
  customerId: string | null;
  inputAppId: string | null;
  outputAppId: string | null;
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
  id: string;
  ticketId: string;
  tenantId: string;
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
  id: string;
  tenantId: string;
  externalId: string | null;
  title: string;
  content: string;
  category: string | null;
  sourceType: 'text' | 'voice';
  metadata: Record<string, any>;
  embedding: number[] | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type TranscriptionStatus = 'pending' | 'transcribing' | 'done' | 'failed';

export interface VoiceRecording {
  id: string;
  tenantId: string;
  sourceAppId: string;
  externalId: string;
  audioUrl: string | null;
  audioAuthHeaders: Record<string, string> | null;
  mimeType: string | null;
  durationSeconds: number | null;
  language: string | null;
  caller: string | null;
  callee: string | null;
  direction: 'inbound' | 'outbound' | null;
  customerId: string | null;
  transcriptionStatus: TranscriptionStatus;
  transcriptionError: string | null;
  transcriptionAttempts: number;
  articleId: string | null;
  metadata: Record<string, any>;
  recordedAt: Date | null;
  transcribedAt: Date | null;
  createdAt: Date;
}

export interface VoiceArticleMetadata {
  audio_url?: string;
  duration_seconds?: number;
  language?: string;
  recorded_at?: string;
  voice_app_code?: string;
  voice_app_id?: string;
  transcriber_app_code?: string;
  transcriber_app_id?: string;
  transcriber_confidence?: number;
  caller?: string;
  callee?: string;
  direction?: 'inbound' | 'outbound';
  customer_id?: string;
  customer_email?: string;
  customer_name?: string;
  customer_phone?: string;
  summary?: string;
}

export interface KnowledgeChunk {
  id: string;
  articleId: string;
  tenantId: string;
  chunkIndex: number;
  content: string;
  embedding: number[] | null;
  createdAt: Date;
}

export interface Draft {
  id: string;
  ticketId: string;
  tenantId: string;
  promptContext: string | null;
  draftResponse: string;
  aiModel: string | null;
  aiTokensUsed: number | null;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
}
