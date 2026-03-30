import crypto from 'crypto';
import { getTestPrisma } from './testDb';

let counter = 0;

function nextId(): number {
  return ++counter;
}

export async function createTenant(
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    name: `Test Tenant ${n}`,
    slug: `test-tenant-${n}`,
    apiKey: crypto.randomBytes(24).toString('hex'),
    settings: {},
    isActive: true,
    ...overrides,
  };

  // Map snake_case overrides to camelCase
  if (overrides.api_key) {
    data.apiKey = overrides.api_key;
  }
  if (overrides.is_active !== undefined) {
    data.isActive = overrides.is_active;
  }

  const tenant = await prisma.tenant.create({ data });
  return {
    id: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    api_key: tenant.apiKey,
    settings: tenant.settings,
    is_active: tenant.isActive,
    created_at: tenant.createdAt,
    updated_at: tenant.updatedAt,
  };
}

export async function createTenantProvider(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const data = {
    tenantId,
    provider: overrides.provider ?? 'intercom',
    credentials: overrides.credentials ?? {
      accessToken: 'test-token',
      clientSecret: 'test-secret',
    },
    webhookSecret: overrides.webhook_secret ?? 'test-webhook-secret',
    isActive: overrides.is_active ?? true,
  };

  const tp = await prisma.tenantProvider.create({ data });
  return {
    id: tp.id,
    tenant_id: tp.tenantId,
    provider: tp.provider,
    credentials: tp.credentials,
    webhook_secret: tp.webhookSecret,
    is_active: tp.isActive,
    created_at: tp.createdAt,
    updated_at: tp.updatedAt,
  };
}

export async function createCustomer(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    tenantId,
    email: overrides.email ?? `customer${n}@example.com`,
    name: overrides.name ?? `Customer ${n}`,
    phone: overrides.phone ?? null,
    externalId: overrides.external_id ?? `ext-${n}`,
    metadata: overrides.metadata ?? {},
  };

  const c = await prisma.customer.create({ data });
  return {
    id: c.id,
    tenant_id: c.tenantId,
    email: c.email,
    name: c.name,
    phone: c.phone,
    external_id: c.externalId,
    metadata: c.metadata,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

export async function createTicket(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    tenantId,
    provider: overrides.provider ?? 'intercom',
    externalId: overrides.external_id ?? `ticket-ext-${n}`,
    state: overrides.state ?? 'open',
    subject: overrides.subject ?? `Test Ticket ${n}`,
    initialBody: overrides.initial_body ?? `This is test ticket ${n}`,
    customerId: overrides.customer_id ?? null,
    language: overrides.language ?? 'en',
    assigneeId: overrides.assignee_id ?? null,
  };

  const t = await prisma.ticket.create({ data });
  return {
    id: t.id,
    tenant_id: t.tenantId,
    provider: t.provider,
    external_id: t.externalId,
    state: t.state,
    subject: t.subject,
    initial_body: t.initialBody,
    customer_id: t.customerId,
    language: t.language,
    assignee_id: t.assigneeId,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export async function createMessage(
  ticketId: number,
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    ticketId,
    tenantId,
    externalId: overrides.external_id ?? `msg-ext-${n}`,
    authorRole: overrides.author_role ?? 'customer',
    authorId: overrides.author_id ?? null,
    authorName: overrides.author_name ?? null,
    body: overrides.body ?? `Test message ${n}`,
  };

  const m = await prisma.message.create({ data });
  return {
    id: m.id,
    ticket_id: m.ticketId,
    tenant_id: m.tenantId,
    external_id: m.externalId,
    author_role: m.authorRole,
    author_id: m.authorId,
    author_name: m.authorName,
    body: m.body,
    created_at: m.createdAt,
  };
}

export async function createKnowledgeArticle(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    tenantId,
    title: overrides.title ?? `Article ${n}`,
    content: overrides.content ?? `Content for article ${n}`,
    category: overrides.category ?? 'general',
    language: overrides.language ?? 'en',
    isActive: overrides.is_active ?? true,
  };

  const a = await prisma.knowledgeArticle.create({ data });
  return {
    id: a.id,
    tenant_id: a.tenantId,
    title: a.title,
    content: a.content,
    category: a.category,
    language: a.language,
    is_active: a.isActive,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}

export async function createDraft(
  ticketId: number,
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const data = {
    ticketId,
    tenantId,
    promptContext: overrides.prompt_context ?? 'Test context',
    draftResponse: overrides.draft_response ?? 'Test draft response',
    aiModel: overrides.ai_model ?? 'deepseek-chat',
    aiTokensUsed: overrides.ai_tokens_used ?? 100,
    status: overrides.status ?? 'pending',
  };

  const d = await prisma.draft.create({ data });
  return {
    id: d.id,
    ticket_id: d.ticketId,
    tenant_id: d.tenantId,
    prompt_context: d.promptContext,
    draft_response: d.draftResponse,
    ai_model: d.aiModel,
    ai_tokens_used: d.aiTokensUsed,
    status: d.status,
    reviewed_by: d.reviewedBy,
    reviewed_at: d.reviewedAt,
    created_at: d.createdAt,
  };
}
