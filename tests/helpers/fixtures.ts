import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getTestPrisma } from './testDb';
import { generateId } from '../../src/utils/uuid';

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
    id: generateId(),
    name: `Test Tenant ${n}`,
    slug: `test-tenant-${n}`,
    apiKey: crypto.randomBytes(24).toString('hex'),
    settings: {},
    isActive: true,
    ...overrides,
  };

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

export async function createApp(
  tenantId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const data = {
    id: generateId(),
    tenantId,
    code: overrides.code ?? 'intercom',
    type: overrides.type ?? 'ticket',
    role: overrides.role ?? 'both',
    name: overrides.name ?? null,
    credentials: overrides.credentials ?? {
      accessToken: 'test-token',
      clientSecret: 'test-secret',
    },
    webhookSecret: overrides.webhook_secret ?? 'test-webhook-secret',
    config: overrides.config ?? {},
    isActive: overrides.is_active ?? true,
  };

  const app = await prisma.app.create({ data });
  return {
    id: app.id,
    tenant_id: app.tenantId,
    code: app.code,
    type: app.type,
    role: app.role,
    name: app.name,
    credentials: app.credentials,
    webhook_secret: app.webhookSecret,
    config: app.config,
    is_active: app.isActive,
    created_at: app.createdAt,
    updated_at: app.updatedAt,
  };
}

export async function createCustomer(
  tenantId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    id: generateId(),
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
  tenantId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    id: generateId(),
    tenantId,
    inputAppId: overrides.input_app_id ?? null,
    outputAppId: overrides.output_app_id ?? null,
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
    input_app_id: t.inputAppId,
    output_app_id: t.outputAppId,
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
  ticketId: string,
  tenantId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    id: generateId(),
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
  tenantId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const data = {
    id: generateId(),
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
  ticketId: string,
  tenantId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const data = {
    id: generateId(),
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

export async function createUser(
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const n = nextId();
  const password = overrides.password ?? 'testpassword123';
  const passwordHash = await bcrypt.hash(password, 4); // low rounds for speed in tests

  const data = {
    id: generateId(),
    email: overrides.email ?? `user${n}@example.com`,
    passwordHash,
    name: overrides.name ?? `Test User ${n}`,
    isActive: overrides.is_active ?? true,
  };

  const u = await prisma.user.create({ data });
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    is_active: u.isActive,
    created_at: u.createdAt,
    updated_at: u.updatedAt,
    _password: password,
  };
}

export async function createTenantUser(
  tenantId: string,
  userId: string,
  overrides: Record<string, any> = {},
): Promise<any> {
  const prisma = getTestPrisma();
  const data = {
    id: generateId(),
    tenantId,
    userId,
    role: overrides.role ?? 'member',
    isActive: overrides.is_active ?? true,
  };

  const tu = await prisma.tenantUser.create({ data });
  return {
    id: tu.id,
    tenant_id: tu.tenantId,
    user_id: tu.userId,
    role: tu.role,
    is_active: tu.isActive,
    created_at: tu.createdAt,
    updated_at: tu.updatedAt,
  };
}
