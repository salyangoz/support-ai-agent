import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveOutputApps } from '../../../src/apps/app.resolver';
import * as appRepo from '../../../src/repositories/app.repository';

vi.mock('../../../src/repositories/app.repository');

const makeApp = (overrides: Record<string, any> = {}) => ({
  id: 1,
  tenantId: 1,
  code: 'intercom',
  type: 'ticket',
  role: 'both',
  name: 'Test',
  credentials: {},
  webhookSecret: null,
  config: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('Output Resolver (resolveOutputApps)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Priority 1: Ticket-level output_app_id override', () => {
    it('should use ticket.outputAppId when set and app is active', async () => {
      const app = makeApp({ id: 5, role: 'destination' });
      vi.mocked(appRepo.findAppById).mockResolvedValue(app as any);

      const result = await resolveOutputApps(1, { outputAppId: 5 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
    });

    it('should skip inactive outputAppId and fall through', async () => {
      vi.mocked(appRepo.findAppById)
        .mockResolvedValueOnce(makeApp({ id: 5, isActive: false }) as any) // outputAppId lookup
        .mockResolvedValueOnce(makeApp({ id: 3, role: 'both' }) as any); // fallback inputAppId

      const result = await resolveOutputApps(1, { outputAppId: 5, inputAppId: 3 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it('should skip source-only outputAppId and fall through', async () => {
      vi.mocked(appRepo.findAppById)
        .mockResolvedValueOnce(makeApp({ id: 5, role: 'source' }) as any)
        .mockResolvedValueOnce(makeApp({ id: 3, role: 'both' }) as any);

      const result = await resolveOutputApps(1, { outputAppId: 5, inputAppId: 3 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });
  });

  describe('Priority 2: Tenant-level fan-out pipeline', () => {
    it('should fan-out to all listed active apps', async () => {
      const app1 = makeApp({ id: 10, role: 'destination' });
      const app2 = makeApp({ id: 11, role: 'both' });

      vi.mocked(appRepo.findAppById)
        .mockResolvedValueOnce(app1 as any)
        .mockResolvedValueOnce(app2 as any);

      const result = await resolveOutputApps(
        1,
        { inputAppId: 99 },
        { output_app_ids: [10, 11] },
      );

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(10);
      expect(result[1].id).toBe(11);
    });

    it('should skip inactive apps in pipeline', async () => {
      const active = makeApp({ id: 10, role: 'destination' });
      const inactive = makeApp({ id: 11, isActive: false });

      vi.mocked(appRepo.findAppById)
        .mockResolvedValueOnce(active as any)
        .mockResolvedValueOnce(inactive as any);

      const result = await resolveOutputApps(
        1,
        {},
        { output_app_ids: [10, 11] },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(10);
    });

    it('should fall through when all pipeline apps are inactive', async () => {
      vi.mocked(appRepo.findAppById)
        .mockResolvedValueOnce(makeApp({ id: 10, isActive: false }) as any) // pipeline app
        .mockResolvedValueOnce(makeApp({ id: 3, role: 'both' }) as any); // fallback

      const result = await resolveOutputApps(
        1,
        { inputAppId: 3 },
        { output_app_ids: [10] },
      );

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });
  });

  describe('Priority 3: Fallback to input app with role=both', () => {
    it('should use input app when role is both', async () => {
      const app = makeApp({ id: 3, role: 'both' });
      vi.mocked(appRepo.findAppById).mockResolvedValue(app as any);

      const result = await resolveOutputApps(1, { inputAppId: 3 });

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3);
    });

    it('should NOT use input app when role is source', async () => {
      const app = makeApp({ id: 3, role: 'source' });
      vi.mocked(appRepo.findAppById).mockResolvedValue(app as any);

      await expect(resolveOutputApps(1, { inputAppId: 3 }))
        .rejects.toThrow('No output app configured');
    });
  });

  describe('Priority 4: No output configured', () => {
    it('should throw when nothing is configured', async () => {
      await expect(resolveOutputApps(1, {}))
        .rejects.toThrow('No output app configured for tenant 1');
    });

    it('should throw when inputAppId is null', async () => {
      await expect(resolveOutputApps(1, { inputAppId: null, outputAppId: null }))
        .rejects.toThrow('No output app configured');
    });
  });
});
