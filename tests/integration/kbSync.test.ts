/**
 * KB Sync integration tests.
 *
 * Uses PGlite (in-memory PostgreSQL) for real database operations.
 * Mocks GitHub API calls via axios.
 * Tests: GitHub app → fetch articles → upsert → chunk → verify DB state.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { setupPGliteDb, teardownPGliteDb, truncateAllPGlite, getPGlitePrisma, getPGlitePool } from '../helpers/pgliteDb';
import { PrismaClient } from '../../src/generated/prisma/client';
import { Pool } from 'pg';

// Mock axios for GitHub API calls
vi.mock('axios', () => {
  const mockPost = vi.fn();
  const mockGet = vi.fn();
  const mockCreate = vi.fn(() => ({ post: mockPost, get: mockGet }));
  return {
    default: { post: mockPost, get: mockGet, create: mockCreate },
    post: mockPost,
    get: mockGet,
    create: mockCreate,
  };
});

// Mock yengec-ai SDK (not used in KB sync, but imported transitively)
vi.mock('../../src/lib/yengec-ai', () => ({
  chat: vi.fn(),
  embed: vi.fn(),
}));

import axios from 'axios';
import { processSyncKbApp } from '../../src/queues/processors/kbSync.processor';
import * as knowledgeBaseService from '../../src/services/knowledgeBase.service';
import { Tenant } from '../../src/models/types';
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

async function createTestTenant(): Promise<Tenant> {
  const t = await prisma.tenant.create({
    data: {
      id: generateId(),
      name: 'KB Test Corp',
      slug: 'kb-test-corp',
      apiKey: 'kb-test-key',
      settings: {},
      isActive: true,
    },
  });
  return { ...t, settings: t.settings as any } as any;
}

async function createGitHubApp(tenantId: string) {
  return prisma.app.create({
    data: {
      id: generateId(),
      tenantId,
      code: 'github',
      type: 'knowledge',
      role: 'source',
      name: 'Test GitHub KB',
      credentials: {
        token: 'ghp_test_token',
        owner: 'testorg',
        repo: 'testrepo',
        path: 'docs',
        branch: 'main',
      },
      isActive: true,
    },
  });
}

const SAMPLE_MD_CONTENT = `# Billing FAQ

## How do refunds work?

If you were charged incorrectly, contact support within 14 days.
We will process your refund within 3-5 business days.

## Subscription plans

We offer three plans: Basic, Pro, and Enterprise.
Each plan includes different features and support levels.

## Payment methods

We accept credit cards, PayPal, and bank transfers.
All payments are processed securely through our payment provider.`;

describe('KB Sync Integration Tests', () => {
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

  describe('GitHub KB Sync → Article + Chunks', () => {
    it('should sync markdown files from GitHub and create articles with chunks', async () => {
      const tenant = await createTestTenant();
      const app = await createGitHubApp(tenant.id);

      // Mock GitHub API: list files
      const mockGet = vi.fn();
      mockGet
        .mockResolvedValueOnce({
          data: [
            { name: 'billing-faq.md', path: 'docs/billing-faq.md', type: 'file', sha: 'abc123', html_url: 'https://github.com/testorg/testrepo/blob/main/docs/billing-faq.md' },
            { name: 'readme.txt', path: 'docs/readme.txt', type: 'file', sha: 'def456' }, // not .md, should be skipped
          ],
        })
        // Mock GitHub API: fetch file content
        .mockResolvedValueOnce({
          data: {
            content: Buffer.from(SAMPLE_MD_CONTENT).toString('base64'),
            encoding: 'base64',
          },
        });

      vi.mocked(axios.create).mockReturnValue({
        get: mockGet,
        post: vi.fn(),
      } as any);

      // Run the sync processor
      await processSyncKbApp({ data: { tenantId: tenant.id, appId: app.id } } as any);

      // Verify article was created
      const articles = await prisma.knowledgeArticle.findMany({ where: { tenantId: tenant.id } });
      expect(articles).toHaveLength(1);
      expect(articles[0].title).toBe('Billing FAQ');
      expect(articles[0].externalId).toBe('github:testorg/testrepo/docs/billing-faq.md');
      expect(articles[0].content).toContain('How do refunds work?');
      expect(articles[0].category).toBe('docs');

      // Verify chunks were created
      const chunks = await prisma.knowledgeChunk.findMany({
        where: { articleId: articles[0].id },
        orderBy: { chunkIndex: 'asc' },
      });
      expect(chunks.length).toBeGreaterThan(0);
      // Each chunk should have content
      for (const chunk of chunks) {
        expect(chunk.content.length).toBeGreaterThan(0);
        expect(chunk.tenantId).toBe(tenant.id);
      }

      // Verify app health was updated
      const updatedApp = await prisma.app.findUnique({ where: { id: app.id } });
      expect(updatedApp!.lastSyncedAt).toBeDefined();
      expect(updatedApp!.lastError).toBeNull();
    });

    it('should upsert article on re-sync without duplicating', async () => {
      const tenant = await createTestTenant();
      const app = await createGitHubApp(tenant.id);

      const mockGet = vi.fn()
        .mockResolvedValueOnce({
          data: [
            { name: 'faq.md', path: 'docs/faq.md', type: 'file', sha: 'v1' },
          ],
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# FAQ\n\nOriginal content').toString('base64') },
        });

      vi.mocked(axios.create).mockReturnValue({ get: mockGet, post: vi.fn() } as any);

      // First sync
      await processSyncKbApp({ data: { tenantId: tenant.id, appId: app.id } } as any);

      let articles = await prisma.knowledgeArticle.findMany({ where: { tenantId: tenant.id } });
      expect(articles).toHaveLength(1);
      expect(articles[0].content).toContain('Original content');

      // Second sync with updated content
      const mockGet2 = vi.fn()
        .mockResolvedValueOnce({
          data: [
            { name: 'faq.md', path: 'docs/faq.md', type: 'file', sha: 'v2' },
          ],
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from('# FAQ\n\nUpdated content with more details').toString('base64') },
        });

      vi.mocked(axios.create).mockReturnValue({ get: mockGet2, post: vi.fn() } as any);

      await processSyncKbApp({ data: { tenantId: tenant.id, appId: app.id } } as any);

      // Still one article, but content updated
      articles = await prisma.knowledgeArticle.findMany({ where: { tenantId: tenant.id } });
      expect(articles).toHaveLength(1);
      expect(articles[0].content).toContain('Updated content');

      // Chunks should be regenerated
      const chunks = await prisma.knowledgeChunk.findMany({ where: { articleId: articles[0].id } });
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks.some((c) => c.content.includes('Updated content'))).toBe(true);
    });

    it('should skip unchanged articles on re-sync', async () => {
      const tenant = await createTestTenant();
      const app = await createGitHubApp(tenant.id);

      const content = '# FAQ\n\nSame content';
      const mockGet = vi.fn()
        .mockResolvedValueOnce({
          data: [{ name: 'faq.md', path: 'docs/faq.md', type: 'file', sha: 'v1' }],
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from(content).toString('base64') },
        });

      vi.mocked(axios.create).mockReturnValue({ get: mockGet, post: vi.fn() } as any);
      await processSyncKbApp({ data: { tenantId: tenant.id, appId: app.id } } as any);

      const chunksAfterFirst = await prisma.knowledgeChunk.findMany({ where: { tenantId: tenant.id } });

      // Re-sync with same content
      const mockGet2 = vi.fn()
        .mockResolvedValueOnce({
          data: [{ name: 'faq.md', path: 'docs/faq.md', type: 'file', sha: 'v1' }],
        })
        .mockResolvedValueOnce({
          data: { content: Buffer.from(content).toString('base64') },
        });

      vi.mocked(axios.create).mockReturnValue({ get: mockGet2, post: vi.fn() } as any);
      await processSyncKbApp({ data: { tenantId: tenant.id, appId: app.id } } as any);

      // Chunks should be the same (not regenerated since content didn't change)
      const chunksAfterSecond = await prisma.knowledgeChunk.findMany({ where: { tenantId: tenant.id } });
      expect(chunksAfterSecond.length).toBe(chunksAfterFirst.length);
    });

    it('should deactivate app on auth failure', async () => {
      const tenant = await createTestTenant();
      const app = await createGitHubApp(tenant.id);

      const mockGet = vi.fn().mockRejectedValue({
        response: { status: 401 },
        message: 'Bad credentials',
      });

      vi.mocked(axios.create).mockReturnValue({ get: mockGet, post: vi.fn() } as any);

      await expect(
        processSyncKbApp({ data: { tenantId: tenant.id, appId: app.id } } as any),
      ).rejects.toBeDefined();

      // App should be deactivated
      const updatedApp = await prisma.app.findUnique({ where: { id: app.id } });
      expect(updatedApp!.isActive).toBe(false);
      expect(updatedApp!.lastError).toBe('Authentication failed');
    });
  });

  describe('Chunking', () => {
    it('should create article via service and auto-chunk', async () => {
      const tenant = await createTestTenant();

      const article = await knowledgeBaseService.createArticle({
        tenantId: tenant.id,
        title: 'Long Guide',
        content: SAMPLE_MD_CONTENT,
      });

      const chunks = await prisma.knowledgeChunk.findMany({
        where: { articleId: article.id },
        orderBy: { chunkIndex: 'asc' },
      });

      expect(chunks.length).toBeGreaterThanOrEqual(1);
      expect(chunks[0].tenantId).toBe(tenant.id);
    });

    it('should rechunk on article update', async () => {
      const tenant = await createTestTenant();

      const article = await knowledgeBaseService.createArticle({
        tenantId: tenant.id,
        title: 'Guide',
        content: 'Short initial content',
      });

      const initialChunks = await prisma.knowledgeChunk.findMany({ where: { articleId: article.id } });

      // Update with content long enough to produce multiple chunks (>1000 chars)
      const longContent = Array(10).fill(SAMPLE_MD_CONTENT).join('\n\n---\n\n');
      await knowledgeBaseService.updateArticle(tenant.id, article.id, {
        content: longContent,
      });

      const updatedChunks = await prisma.knowledgeChunk.findMany({ where: { articleId: article.id } });
      expect(updatedChunks.length).toBeGreaterThan(initialChunks.length);
    });
  });
});
