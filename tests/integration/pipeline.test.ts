/**
 * End-to-end pipeline integration tests.
 *
 * Uses PGlite (in-memory PostgreSQL) for real database operations.
 * Only mocks external HTTP calls (AI service, Intercom API).
 * Tests the full flow: webhook → DB storage → draft generation → send.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupPGliteDb, teardownPGliteDb, truncateAllPGlite, getPGlitePrisma, getPGlitePool } from '../helpers/pgliteDb';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Pool } from 'pg';

// Mock only external HTTP calls
vi.mock('axios', () => {
  const mockPost = vi.fn();
  return {
    default: { post: mockPost, create: vi.fn(() => ({ post: mockPost, get: vi.fn() })) },
    post: mockPost,
  };
});

// Mock the yengec-ai SDK since it has its own axios instance
vi.mock('../../src/lib/yengec-ai', () => {
  const mockChat = vi.fn();
  const mockEmbed = vi.fn();
  return {
    chat: mockChat,
    embed: mockEmbed,
  };
});

import axios from 'axios';
import { chat as mockYengecChat, embed as mockYengecEmbed } from '../../src/lib/yengec-ai';
import * as webhookHandler from '../../src/services/webhookHandler.service';
import * as aiDraftService from '../../src/services/aiDraft.service';
import * as ticketSyncService from '../../src/services/ticketSync.service';
import { createInputApp } from '../../src/apps/app.factory';
import { resolveOutputApps } from '../../src/apps/app.resolver';
import { Tenant, App } from '../../src/models/types';
import { generateId } from '../../src/utils/uuid';

let prisma: PrismaClient;
let pool: Pool;

// Override the app's database module to use PGlite
vi.mock('../../src/database/prisma', () => ({
  getPrisma: () => getPGlitePrisma(),
  closePrisma: async () => {},
}));

vi.mock('../../src/database/pool', () => ({
  getPool: () => getPGlitePool(),
  closePool: async () => {},
}));

// Helper to create a 1536-dim vector string (pgvector format)
function makeVector(seed: number = 0): string {
  return '[' + Array(1536).fill(0).map((_, i) => ((i + seed) * 0.001).toFixed(4)).join(',') + ']';
}

// Helper to create test data
async function createTestTenant(settings: Record<string, any> = {}): Promise<Tenant> {
  const t = await prisma.tenant.create({
    data: {
      id: generateId(),
      name: 'Test Corp',
      slug: 'test-corp',
      apiKey: 'test-key-123',
      settings,
      isActive: true,
    },
  });
  return { ...t, settings: t.settings as any } as any;
}

async function createTestApp(tenantId: string, overrides: Record<string, any> = {}): Promise<App> {
  const a = await prisma.app.create({
    data: {
      id: generateId(),
      tenantId,
      code: 'intercom',
      type: 'ticket',
      role: 'both',
      credentials: { accessToken: 'test-tok', clientSecret: 'test-sec' },
      ...overrides,
    },
  });
  return a as any;
}

describe('E2E Pipeline Integration Tests', () => {
  beforeAll(async () => {
    const db = await setupPGliteDb();
    prisma = db.prisma;
    pool = db.pool;
  }, 30000);

  afterAll(async () => {
    await teardownPGliteDb();
  });

  beforeEach(async () => {
    await truncateAllPGlite();
    vi.clearAllMocks();
  });

  describe('Webhook → Ticket + Message Storage', () => {
    it('should create ticket and customer from new_ticket event', async () => {
      const tenant = await createTestTenant();
      const app = await createTestApp(tenant.id);

      await webhookHandler.handleEvent(tenant, app as any, {
        type: 'new_ticket',
        ticketExternalId: 'conv-100',
        data: {
          state: 'open',
          subject: 'Login issue',
          latestMessageBody: 'I cannot log in',
          customerEmail: 'alice@test.com',
          customerName: 'Alice',
        },
      });

      // Verify ticket was created in DB
      const tickets = await prisma.ticket.findMany({ where: { tenantId: tenant.id } });
      expect(tickets).toHaveLength(1);
      expect(tickets[0].externalId).toBe('conv-100');
      expect(tickets[0].inputAppId).toBe(app.id);
      expect(tickets[0].state).toBe('open');
      expect(tickets[0].subject).toBe('Login issue');

      // Verify customer was created in DB
      const customers = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
      expect(customers).toHaveLength(1);
      expect(customers[0].email).toBe('alice@test.com');
      expect(customers[0].name).toBe('Alice');

      // Verify ticket is linked to customer
      expect(tickets[0].customerId).toBe(customers[0].id);
    });

    it('should create message and trigger draft from new_customer_reply event', async () => {
      const tenant = await createTestTenant();
      const app = await createTestApp(tenant.id);

      // Create initial ticket
      const ticket = await prisma.ticket.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          inputAppId: app.id,
          externalId: 'conv-200',
          state: 'open',
        },
      });

      // Create initial customer message so generateDraft has something to work with
      await prisma.message.create({
        data: {
          id: generateId(),
          ticketId: ticket.id,
          tenantId: tenant.id,
          externalId: 'msg-prev',
          authorRole: 'customer',
          body: 'Initial question',
        },
      });

      // Mock external HTTP: embed + AI chat
      vi.mocked(mockYengecEmbed).mockResolvedValue(Array(1536).fill(0.01));
      vi.mocked(mockYengecChat).mockResolvedValue({ text: 'Hi! Let me help you with that.', tokensUsed: 150 });

      await webhookHandler.handleEvent(tenant, app as any, {
        type: 'new_customer_reply',
        ticketExternalId: 'conv-200',
        data: {
          latestMessageBody: 'My order #456 is missing',
          latestMessageExternalId: 'msg-201',
          latestMessageAuthorId: 'user-10',
          latestMessageAuthorName: 'Bob',
          customerEmail: 'bob@test.com',
          customerName: 'Bob',
        },
      });

      // Verify message was stored in DB
      const messages = await prisma.message.findMany({
        where: { ticketId: ticket.id },
        orderBy: { createdAt: 'asc' },
      });
      expect(messages.length).toBeGreaterThanOrEqual(2);
      const lastMsg = messages[messages.length - 1];
      expect(lastMsg.authorRole).toBe('customer');
      expect(lastMsg.body).toBe('My order #456 is missing');

      // Verify AI draft was generated and stored
      const drafts = await prisma.draft.findMany({ where: { ticketId: ticket.id } });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].status).toBe('pending');
      expect(drafts[0].draftResponse).toBe('Hi! Let me help you with that.');
      expect(drafts[0].aiTokensUsed).toBe(150);
    });

    it('should auto-send draft when tenant has auto_send_drafts enabled', async () => {
      const tenant = await createTestTenant({ auto_send_drafts: true });
      const app = await createTestApp(tenant.id);

      // Pre-create ticket with message
      const ticket = await prisma.ticket.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          inputAppId: app.id,
          externalId: 'conv-300',
          state: 'open',
        },
      });
      await prisma.message.create({
        data: {
          id: generateId(),
          ticketId: ticket.id,
          tenantId: tenant.id,
          externalId: 'msg-init',
          authorRole: 'customer',
          body: 'Help',
        },
      });

      // Mock AI SDK: embed + chat
      vi.mocked(mockYengecEmbed).mockResolvedValue(Array(1536).fill(0.01));
      vi.mocked(mockYengecChat).mockResolvedValue({ text: 'Auto-generated reply', tokensUsed: 100 });

      // Mock Intercom reply API (sendReply creates an axios instance internally)
      vi.mocked(axios.create).mockReturnValue({
        post: vi.fn().mockResolvedValue({ data: {} }),
        get: vi.fn(),
      } as any);

      await webhookHandler.handleEvent(tenant, app as any, {
        type: 'new_customer_reply',
        ticketExternalId: 'conv-300',
        data: {
          latestMessageBody: 'Please hurry',
          latestMessageExternalId: 'msg-301',
        },
      });

      // Verify draft was created AND sent
      const drafts = await prisma.draft.findMany({ where: { ticketId: ticket.id } });
      expect(drafts).toHaveLength(1);
      expect(drafts[0].status).toBe('sent');
    });
  });

  describe('Ticket Closed → Embedding Backfill', () => {
    it('should update ticket state and embed agent messages on close', async () => {
      const tenant = await createTestTenant();
      const app = await createTestApp(tenant.id);

      const ticket = await prisma.ticket.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          inputAppId: app.id,
          externalId: 'conv-400',
          state: 'open',
        },
      });

      // Create agent message (should get embedded on close)
      await prisma.message.create({
        data: {
          id: generateId(),
          ticketId: ticket.id,
          tenantId: tenant.id,
          externalId: 'msg-agent-1',
          authorRole: 'agent',
          body: 'I resolved your issue by resetting your password.',
        },
      });

      // Mock embedding service
      vi.mocked(mockYengecEmbed).mockResolvedValue(Array(1536).fill(0.01));

      await webhookHandler.handleEvent(tenant, app as any, {
        type: 'ticket_closed',
        ticketExternalId: 'conv-400',
        data: {},
      });

      // Verify ticket state changed to closed
      const closedTicket = await prisma.ticket.findFirst({ where: { id: ticket.id } });
      expect(closedTicket!.state).toBe('closed');

      // Verify agent message got embedded (check via raw SQL since Prisma can't read vector)
      const { rows } = await pool.query(
        'SELECT id, embedding IS NOT NULL as has_embedding FROM messages WHERE ticket_id = $1 AND author_role = $2',
        [ticket.id, 'agent'],
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].has_embedding).toBe(true);
    });
  });

  describe('Output Resolver - Fan-out', () => {
    it('should resolve output from input app with role=both', async () => {
      const tenant = await createTestTenant();
      const app = await createTestApp(tenant.id, { role: 'both' });

      const result = await resolveOutputApps(tenant.id, { inputAppId: app.id });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(app.id);
    });

    it('should fan-out to multiple output apps from tenant settings', async () => {
      const tenant = await createTestTenant();
      const app1 = await createTestApp(tenant.id, { role: 'destination', code: 'intercom' });
      const app2 = await createTestApp(tenant.id, { role: 'destination', code: 'intercom' });

      // Update tenant settings with output pipeline
      await prisma.tenant.update({
        where: { id: tenant.id },
        data: { settings: { output_app_ids: [app1.id, app2.id] } },
      });

      const updatedTenant = await prisma.tenant.findUnique({ where: { id: tenant.id } });
      const settings = updatedTenant!.settings as any;

      const result = await resolveOutputApps(tenant.id, {}, settings);

      expect(result).toHaveLength(2);
      expect(result.map(a => a.id).sort()).toEqual([app1.id, app2.id].sort());
    });

    it('should use ticket-level override over tenant pipeline', async () => {
      const tenant = await createTestTenant();
      const inputApp = await createTestApp(tenant.id, { role: 'both' });
      const overrideApp = await createTestApp(tenant.id, { role: 'destination', code: 'intercom' });

      const result = await resolveOutputApps(
        tenant.id,
        { inputAppId: inputApp.id, outputAppId: overrideApp.id },
        { output_app_ids: [inputApp.id] },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(overrideApp.id);
    });

    it('should throw when no output configured', async () => {
      const tenant = await createTestTenant();
      const sourceOnlyApp = await createTestApp(tenant.id, { role: 'source' });

      await expect(
        resolveOutputApps(tenant.id, { inputAppId: sourceOnlyApp.id }),
      ).rejects.toThrow('No output app configured');
    });
  });

  describe('Full Pipeline: Generate → Approve → Send', () => {
    it('should generate draft from ticket data using RAG context', async () => {
      const tenant = await createTestTenant();
      const app = await createTestApp(tenant.id);

      const customer = await prisma.customer.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          email: 'jane@test.com',
          name: 'Jane Doe',
          metadata: { plan: 'enterprise', region: 'EU' },
        },
      });

      const ticket = await prisma.ticket.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          inputAppId: app.id,
          externalId: 'conv-500',
          state: 'open',
          subject: 'Billing question',
          customerId: customer.id,
        },
      });

      await prisma.message.create({
        data: {
          id: generateId(),
          ticketId: ticket.id,
          tenantId: tenant.id,
          externalId: 'msg-500',
          authorRole: 'customer',
          body: 'Why was I charged twice for my subscription?',
        },
      });

      // Create KB article + chunk (RAG search uses chunks)
      const article = await prisma.knowledgeArticle.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          title: 'Billing & Refunds',
          content: 'If you were charged twice, we can issue a refund within 14 days.',
          isActive: true,
        },
      });
      const chunk = await prisma.knowledgeChunk.create({
        data: {
          id: generateId(),
          articleId: article.id,
          tenantId: tenant.id,
          chunkIndex: 0,
          content: 'Billing & Refunds\n\nIf you were charged twice, we can issue a refund within 14 days.',
        },
      });
      await pool.query(
        'UPDATE knowledge_chunks SET embedding = $1::vector WHERE id = $2',
        [makeVector(1), chunk.id],
      );

      // Mock embedding service (for customer message embedding)
      const embeddingVector = Array(1536).fill(0).map((_, i) => (i + 1) * 0.001);
      vi.mocked(mockYengecEmbed).mockResolvedValue(embeddingVector);
      vi.mocked(mockYengecChat).mockResolvedValue({
        text: 'Hi Jane, I see you were double-charged. I will process a refund immediately.',
        tokensUsed: 200,
      });

      const draft = await aiDraftService.generateDraft(tenant, ticket.id);

      // Verify draft was created with correct data
      expect(draft.draftResponse).toBe('Hi Jane, I see you were double-charged. I will process a refund immediately.');
      expect(draft.status).toBe('pending');
      expect(draft.aiTokensUsed).toBe(200);

      // Verify draft is in DB
      const dbDraft = await prisma.draft.findFirst({ where: { ticketId: ticket.id } });
      expect(dbDraft).not.toBeNull();
      expect(dbDraft!.draftResponse).toBe(draft.draftResponse);

      // Verify prompt context includes KB article and customer info
      expect(dbDraft!.promptContext).toContain('Billing & Refunds');
      expect(dbDraft!.promptContext).toContain('Jane Doe');
    });

    it('should approve and send draft to output app', async () => {
      const tenant = await createTestTenant();
      const app = await createTestApp(tenant.id);

      const ticket = await prisma.ticket.create({
        data: {
          id: generateId(),
          tenantId: tenant.id,
          inputAppId: app.id,
          externalId: 'conv-600',
          state: 'open',
        },
      });

      const draft = await prisma.draft.create({
        data: {
          id: generateId(),
          ticketId: ticket.id,
          tenantId: tenant.id,
          draftResponse: 'Your issue has been resolved.',
          promptContext: 'test context',
          status: 'approved',
        },
      });

      // Mock Intercom reply API
      const mockIntercomPost = vi.fn().mockResolvedValue({ data: {} });
      vi.mocked(axios.create).mockReturnValue({
        post: mockIntercomPost,
        get: vi.fn(),
      } as any);

      await aiDraftService.sendDraft(tenant, draft.id);

      // Verify draft status changed to 'sent' in DB
      const sentDraft = await prisma.draft.findFirst({ where: { id: draft.id } });
      expect(sentDraft!.status).toBe('sent');

      // Verify Intercom API was called with correct params
      expect(mockIntercomPost).toHaveBeenCalledWith(
        '/conversations/conv-600/reply',
        expect.objectContaining({
          body: 'Your issue has been resolved.',
          message_type: 'comment',
        }),
      );
    });
  });

  describe('Ticket Sync: Polling → DB Storage', () => {
    it('should fetch tickets from input app and store in DB with messages', async () => {
      const tenant = await createTestTenant({ sync_lookback_minutes: 15 });
      const app = await createTestApp(tenant.id);

      // Mock the Intercom API calls that the real IntercomInputApp makes
      const mockIntercomGet = vi.fn().mockResolvedValue({
        data: {
          conversation_parts: { conversation_parts: [
            { id: 'part-1', body: 'I need help', author: { type: 'user', id: 'u1', name: 'Alice' }, created_at: 1700000000 },
            { id: 'part-2', body: 'Let me check', author: { type: 'admin', id: 'a1', name: 'Support' }, created_at: 1700000100 },
          ] },
        },
      });
      const mockIntercomPost = vi.fn().mockResolvedValue({
        data: {
          conversations: [
            {
              id: 'conv-sync-1',
              state: 'open',
              title: 'Order problem',
              source: { body: '<p>My order is late</p>', author: { type: 'user', id: 'u1' } },
              contacts: { contacts: [{ id: 'u1', email: 'sync-test@test.com', name: 'Sync User' }] },
              created_at: 1700000000,
              updated_at: 1700000200,
            },
          ],
        },
      });

      vi.mocked(axios.create).mockReturnValue({
        post: mockIntercomPost,
        get: mockIntercomGet,
      } as any);

      // Mock embedding for agent messages
      vi.mocked(mockYengecEmbed).mockResolvedValue(Array(1536).fill(0.02));

      await ticketSyncService.syncInputApp(tenant, app as any);

      // Verify ticket was created in DB
      const tickets = await prisma.ticket.findMany({ where: { tenantId: tenant.id } });
      expect(tickets).toHaveLength(1);
      expect(tickets[0].externalId).toBe('conv-sync-1');
      expect(tickets[0].inputAppId).toBe(app.id);
      expect(tickets[0].state).toBe('open');

      // Verify customer was created
      const customers = await prisma.customer.findMany({ where: { tenantId: tenant.id } });
      expect(customers).toHaveLength(1);
      expect(customers[0].email).toBe('sync-test@test.com');

      // Verify messages were stored
      const messages = await prisma.message.findMany({ where: { tenantId: tenant.id } });
      expect(messages.length).toBeGreaterThanOrEqual(2);

      // Verify agent message got embedded
      const { rows } = await pool.query(
        'SELECT embedding IS NOT NULL as has_embedding FROM messages WHERE tenant_id = $1 AND author_role = $2',
        [tenant.id, 'agent'],
      );
      const agentEmbedded = rows.filter((r: any) => r.has_embedding);
      expect(agentEmbedded.length).toBeGreaterThanOrEqual(1);
    });
  });
});
