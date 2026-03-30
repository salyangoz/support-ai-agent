import crypto from 'crypto';
import { getTestPool } from './testDb';

let counter = 0;

function nextId(): number {
  return ++counter;
}

export async function createTenant(overrides: Record<string, any> = {}): Promise<any> {
  const pool = getTestPool();
  const n = nextId();
  const data = {
    name: `Test Tenant ${n}`,
    slug: `test-tenant-${n}`,
    api_key: crypto.randomBytes(24).toString('hex'),
    settings: JSON.stringify({}),
    is_active: true,
    ...overrides,
  };

  if (typeof data.settings === 'object' && !(typeof data.settings === 'string')) {
    data.settings = JSON.stringify(data.settings);
  }

  const { rows } = await pool.query(
    `INSERT INTO tenants (name, slug, api_key, settings, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [data.name, data.slug, data.api_key, data.settings, data.is_active],
  );
  return rows[0];
}

export async function createTenantProvider(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const pool = getTestPool();
  const data = {
    provider: 'intercom',
    credentials: JSON.stringify({ accessToken: 'test-token', clientSecret: 'test-secret' }),
    webhook_secret: 'test-webhook-secret',
    is_active: true,
    ...overrides,
  };

  if (typeof data.credentials === 'object' && !(typeof data.credentials === 'string')) {
    data.credentials = JSON.stringify(data.credentials);
  }

  const { rows } = await pool.query(
    `INSERT INTO tenant_providers (tenant_id, provider, credentials, webhook_secret, is_active)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [tenantId, data.provider, data.credentials, data.webhook_secret, data.is_active],
  );
  return rows[0];
}

export async function createCustomer(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const pool = getTestPool();
  const n = nextId();
  const data = {
    email: `customer${n}@example.com`,
    name: `Customer ${n}`,
    phone: null,
    external_id: `ext-${n}`,
    metadata: JSON.stringify({}),
    ...overrides,
  };

  if (typeof data.metadata === 'object' && !(typeof data.metadata === 'string')) {
    data.metadata = JSON.stringify(data.metadata);
  }

  const { rows } = await pool.query(
    `INSERT INTO customers (tenant_id, email, name, phone, external_id, metadata)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, data.email, data.name, data.phone, data.external_id, data.metadata],
  );
  return rows[0];
}

export async function createTicket(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const pool = getTestPool();
  const n = nextId();
  const data = {
    provider: 'intercom',
    external_id: `ticket-ext-${n}`,
    state: 'open',
    subject: `Test Ticket ${n}`,
    initial_body: `This is test ticket ${n}`,
    customer_id: null,
    language: 'en',
    assignee_id: null,
    ...overrides,
  };

  const { rows } = await pool.query(
    `INSERT INTO tickets (tenant_id, provider, external_id, state, subject, initial_body,
     customer_id, language, assignee_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [tenantId, data.provider, data.external_id, data.state, data.subject,
     data.initial_body, data.customer_id, data.language, data.assignee_id],
  );
  return rows[0];
}

export async function createMessage(
  ticketId: number,
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const pool = getTestPool();
  const n = nextId();
  const data = {
    external_id: `msg-ext-${n}`,
    author_role: 'customer',
    author_id: null,
    author_name: null,
    body: `Test message ${n}`,
    ...overrides,
  };

  const { rows } = await pool.query(
    `INSERT INTO messages (ticket_id, tenant_id, external_id, author_role, author_id, author_name, body)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [ticketId, tenantId, data.external_id, data.author_role, data.author_id, data.author_name, data.body],
  );
  return rows[0];
}

export async function createKnowledgeArticle(
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const pool = getTestPool();
  const n = nextId();
  const data = {
    title: `Article ${n}`,
    content: `Content for article ${n}`,
    category: 'general',
    language: 'en',
    is_active: true,
    ...overrides,
  };

  const { rows } = await pool.query(
    `INSERT INTO knowledge_articles (tenant_id, title, content, category, language, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [tenantId, data.title, data.content, data.category, data.language, data.is_active],
  );
  return rows[0];
}

export async function createDraft(
  ticketId: number,
  tenantId: number,
  overrides: Record<string, any> = {},
): Promise<any> {
  const pool = getTestPool();
  const data = {
    prompt_context: 'Test context',
    draft_response: 'Test draft response',
    ai_model: 'deepseek-chat',
    ai_tokens_used: 100,
    status: 'pending',
    ...overrides,
  };

  const { rows } = await pool.query(
    `INSERT INTO drafts (ticket_id, tenant_id, prompt_context, draft_response, ai_model, ai_tokens_used, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [ticketId, tenantId, data.prompt_context, data.draft_response, data.ai_model, data.ai_tokens_used, data.status],
  );
  return rows[0];
}
