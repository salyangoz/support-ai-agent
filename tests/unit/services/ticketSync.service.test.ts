import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as ticketSyncService from '../../../src/services/ticketSync.service';
import * as ticketRepo from '../../../src/repositories/ticket.repository';
import * as messageRepo from '../../../src/repositories/message.repository';
import * as customerRepo from '../../../src/repositories/customer.repository';
import { Tenant, App } from '../../../src/models/types';

vi.mock('../../../src/repositories/ticket.repository');
vi.mock('../../../src/repositories/message.repository');
vi.mock('../../../src/repositories/customer.repository');
vi.mock('../../../src/repositories/tenant.repository');
vi.mock('../../../src/services/embedding.service', () => ({
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

// Mock the app factory to return a controllable mock adapter
const mockFetchRecentTickets = vi.fn();
const mockFetchTicketMessages = vi.fn();

vi.mock('../../../src/apps/app.factory', () => ({
  createInputApp: vi.fn(() => ({
    fetchRecentTickets: mockFetchRecentTickets,
    fetchTicketMessages: mockFetchTicketMessages,
    verifyWebhook: vi.fn(),
    parseWebhook: vi.fn(),
  })),
}));

const tenant: Tenant = {
  id: 1,
  name: 'Test',
  slug: 'test',
  apiKey: 'key',
  settings: { sync_lookback_minutes: 15 },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const app: App = {
  id: 10,
  tenantId: 1,
  code: 'intercom',
  type: 'ticket',
  role: 'both',
  name: 'Test Intercom',
  credentials: { accessToken: 'tok', clientSecret: 'sec' },
  webhookSecret: null,
  config: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('TicketSync Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncInputApp', () => {
    it('should fetch tickets, create customers, upsert tickets and messages', async () => {
      mockFetchRecentTickets.mockResolvedValue([
        {
          externalId: 'conv-1',
          subject: 'Login issue',
          state: 'open',
          customerEmail: 'alice@test.com',
          customerName: 'Alice',
          initialBody: 'Cannot log in',
        },
      ]);

      mockFetchTicketMessages.mockResolvedValue([
        {
          externalId: 'msg-1',
          authorRole: 'customer',
          authorName: 'Alice',
          body: 'Cannot log in',
        },
        {
          externalId: 'msg-2',
          authorRole: 'agent',
          authorName: 'Support',
          body: 'Try resetting your password',
        },
      ]);

      vi.mocked(customerRepo.upsertCustomer).mockResolvedValue({ id: 5 } as any);
      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 1 } as any);
      vi.mocked(messageRepo.upsertMessage).mockResolvedValue({ id: 1 } as any);
      vi.mocked(messageRepo.updateMessageEmbedding).mockResolvedValue({} as any);

      await ticketSyncService.syncInputApp(tenant, app);

      // Verify tickets were fetched with tenant's lookback setting
      expect(mockFetchRecentTickets).toHaveBeenCalledWith(15);

      // Verify customer was created
      expect(customerRepo.upsertCustomer).toHaveBeenCalledWith({
        tenantId: 1,
        email: 'alice@test.com',
        name: 'Alice',
      });

      // Verify ticket was upserted with inputAppId
      expect(ticketRepo.upsertTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          inputAppId: 10,
          externalId: 'conv-1',
          subject: 'Login issue',
          customerId: 5,
        }),
      );

      // Verify messages were upserted
      expect(messageRepo.upsertMessage).toHaveBeenCalledTimes(2);

      // Verify agent message got embedded
      expect(messageRepo.updateMessageEmbedding).toHaveBeenCalledTimes(1);
    });

    it('should handle tickets without customer email', async () => {
      mockFetchRecentTickets.mockResolvedValue([
        {
          externalId: 'conv-2',
          state: 'open',
          // no customerEmail
        },
      ]);

      mockFetchTicketMessages.mockResolvedValue([]);

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 2 } as any);

      await ticketSyncService.syncInputApp(tenant, app);

      expect(customerRepo.upsertCustomer).not.toHaveBeenCalled();
      expect(ticketRepo.upsertTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          inputAppId: 10,
          customerId: undefined,
        }),
      );
    });

    it('should handle empty ticket list', async () => {
      mockFetchRecentTickets.mockResolvedValue([]);

      await ticketSyncService.syncInputApp(tenant, app);

      expect(ticketRepo.upsertTicket).not.toHaveBeenCalled();
      expect(messageRepo.upsertMessage).not.toHaveBeenCalled();
    });

    it('should not embed customer messages, only agent messages', async () => {
      mockFetchRecentTickets.mockResolvedValue([
        { externalId: 'conv-3', state: 'open' },
      ]);

      mockFetchTicketMessages.mockResolvedValue([
        { externalId: 'msg-10', authorRole: 'customer', body: 'Help me' },
        { externalId: 'msg-11', authorRole: 'bot', body: 'Auto reply' },
        { externalId: 'msg-12', authorRole: 'agent', body: 'Let me check' },
      ]);

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 3 } as any);
      vi.mocked(messageRepo.upsertMessage).mockResolvedValue({ id: 1 } as any);
      vi.mocked(messageRepo.updateMessageEmbedding).mockResolvedValue({} as any);

      await ticketSyncService.syncInputApp(tenant, app);

      // Only agent message should be embedded (not customer, not bot)
      expect(messageRepo.updateMessageEmbedding).toHaveBeenCalledTimes(1);
    });
  });
});
