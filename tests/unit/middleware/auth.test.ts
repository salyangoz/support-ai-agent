import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';

vi.mock('../../../src/repositories/tenant.repository', () => ({
  findTenantByApiKey: vi.fn(),
}));

vi.mock('../../../src/config', () => ({
  config: { adminApiKey: 'admin-secret-key' },
  defaults: {},
}));

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockReq = { headers: {}, params: {} };
    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    mockNext = vi.fn();
  });

  describe('adminAuth', () => {
    it('should pass with valid admin key', async () => {
      const { adminAuth } = await import('../../../src/middleware/auth');
      mockReq.headers = { 'x-api-key': 'admin-secret-key' };

      await adminAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should return 401 with missing key', async () => {
      const { adminAuth } = await import('../../../src/middleware/auth');
      mockReq.headers = {};

      await adminAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 with invalid key', async () => {
      const { adminAuth } = await import('../../../src/middleware/auth');
      mockReq.headers = { 'x-api-key': 'wrong-key' };

      await adminAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('tenantAuth', () => {
    it('should set req.tenant with valid API key', async () => {
      const tenantRepo = await import('../../../src/repositories/tenant.repository');
      const mockTenant = { id: 1, name: 'Test', slug: 'test', apiKey: 'tenant-key', isActive: true };
      vi.mocked(tenantRepo.findTenantByApiKey).mockResolvedValue(mockTenant as any);

      const { tenantAuth } = await import('../../../src/middleware/auth');
      mockReq.headers = { 'x-api-key': 'tenant-key' };
      mockReq.params = { tenantId: '1' };

      await tenantAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
      expect((mockReq as any).tenant).toEqual(mockTenant);
    });

    it('should return 401 with invalid API key', async () => {
      const tenantRepo = await import('../../../src/repositories/tenant.repository');
      vi.mocked(tenantRepo.findTenantByApiKey).mockResolvedValue(undefined as any);

      const { tenantAuth } = await import('../../../src/middleware/auth');
      mockReq.headers = { 'x-api-key': 'bad-key' };

      await tenantAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 403 if tenantId does not match', async () => {
      const tenantRepo = await import('../../../src/repositories/tenant.repository');
      const mockTenant = { id: 1, name: 'Test', slug: 'test', apiKey: 'tenant-key', isActive: true };
      vi.mocked(tenantRepo.findTenantByApiKey).mockResolvedValue(mockTenant as any);

      const { tenantAuth } = await import('../../../src/middleware/auth');
      mockReq.headers = { 'x-api-key': 'tenant-key' };
      mockReq.params = { tenantId: '999' };

      await tenantAuth(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(403);
    });
  });
});
