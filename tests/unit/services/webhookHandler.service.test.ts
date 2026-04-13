import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as webhookHandler from '../../../src/services/webhookHandler.service';
import * as ticketRepo from '../../../src/repositories/ticket.repository';
import * as messageRepo from '../../../src/repositories/message.repository';
import * as customerRepo from '../../../src/repositories/customer.repository';
import * as aiDraftService from '../../../src/services/aiDraft.service';
import { WebhookEvent } from '../../../src/apps/app.interface';
import { Tenant, App } from '../../../src/models/types';

vi.mock('../../../src/repositories/ticket.repository');
vi.mock('../../../src/repositories/message.repository');
vi.mock('../../../src/repositories/customer.repository');
vi.mock('../../../src/services/aiDraft.service');
vi.mock('../../../src/services/embedding.service', () => ({
  embed: vi.fn().mockResolvedValue(null),
}));

const tenant: Tenant = {
  id: 1,
  name: 'Test Tenant',
  slug: 'test',
  apiKey: 'key',
  settings: {},
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
  webhookSecret: 'wh-sec',
  config: {},
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('WebhookHandler Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleEvent - new_ticket', () => {
    it('should upsert customer and ticket from new_ticket event', async () => {
      const event: WebhookEvent = {
        type: 'new_ticket',
        ticketExternalId: 'conv-100',
        data: {
          state: 'open',
          subject: 'Help me',
          latestMessageBody: 'I need help',
          assigneeId: 'admin-1',
          customerEmail: 'jane@test.com',
          customerName: 'Jane',
          createdAt: 1700000000,
        },
      };

      vi.mocked(customerRepo.upsertCustomer).mockResolvedValue({ id: 5 } as any);
      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 1 } as any);

      await webhookHandler.handleEvent(tenant, app, event);

      expect(customerRepo.upsertCustomer).toHaveBeenCalledWith({
        tenantId: 1,
        email: 'jane@test.com',
        name: 'Jane',
      });

      expect(ticketRepo.upsertTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          inputAppId: 10,
          externalId: 'conv-100',
          state: 'open',
          subject: 'Help me',
          customerId: 5,
        }),
      );
    });

    it('should handle missing customer email gracefully', async () => {
      const event: WebhookEvent = {
        type: 'new_ticket',
        ticketExternalId: 'conv-101',
        data: { state: 'open' },
      };

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 2 } as any);

      await webhookHandler.handleEvent(tenant, app, event);

      expect(customerRepo.upsertCustomer).not.toHaveBeenCalled();
      expect(ticketRepo.upsertTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          inputAppId: 10,
          customerId: undefined,
        }),
      );
    });
  });

  describe('handleEvent - new_customer_reply', () => {
    it('should create message and trigger draft generation', async () => {
      const event: WebhookEvent = {
        type: 'new_customer_reply',
        ticketExternalId: 'conv-200',
        data: {
          customerEmail: 'bob@test.com',
          customerName: 'Bob',
          latestMessageBody: 'My order is late',
          latestMessageExternalId: 'msg-201',
          latestMessageAuthorId: 'user-50',
          latestMessageAuthorName: 'Bob',
        },
      };

      vi.mocked(customerRepo.upsertCustomer).mockResolvedValue({ id: 7 } as any);
      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 3 } as any);
      vi.mocked(messageRepo.upsertMessage).mockResolvedValue({ id: 10 } as any);
      vi.mocked(aiDraftService.generateDraft).mockResolvedValue({ id: 20 } as any);

      await webhookHandler.handleEvent(tenant, app, event);

      expect(ticketRepo.upsertTicket).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 1,
          inputAppId: 10,
          externalId: 'conv-200',
        }),
      );

      expect(messageRepo.upsertMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          ticketId: 3,
          tenantId: 1,
          externalId: 'msg-201',
          authorRole: 'customer',
          body: 'My order is late',
        }),
      );

      expect(aiDraftService.generateDraft).toHaveBeenCalledWith(tenant, 3);
    });

    it('should auto-send draft when auto_send_drafts is enabled', async () => {
      const autoSendTenant: Tenant = {
        ...tenant,
        settings: { auto_send_drafts: true },
      };

      const event: WebhookEvent = {
        type: 'new_customer_reply',
        ticketExternalId: 'conv-300',
        data: {
          latestMessageBody: 'Where is my package?',
          latestMessageExternalId: 'msg-301',
        },
      };

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 4 } as any);
      vi.mocked(messageRepo.upsertMessage).mockResolvedValue({ id: 11 } as any);
      vi.mocked(aiDraftService.generateDraft).mockResolvedValue({ id: 21 } as any);
      vi.mocked(aiDraftService.sendDraft).mockResolvedValue({ id: 21 } as any);

      await webhookHandler.handleEvent(autoSendTenant, app, event);

      expect(aiDraftService.generateDraft).toHaveBeenCalledWith(autoSendTenant, 4);
      expect(aiDraftService.sendDraft).toHaveBeenCalledWith(autoSendTenant, 21);
    });

    it('should NOT auto-send when auto_send_drafts is disabled', async () => {
      const event: WebhookEvent = {
        type: 'new_customer_reply',
        ticketExternalId: 'conv-400',
        data: {
          latestMessageBody: 'Hello',
          latestMessageExternalId: 'msg-401',
        },
      };

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 5 } as any);
      vi.mocked(messageRepo.upsertMessage).mockResolvedValue({ id: 12 } as any);
      vi.mocked(aiDraftService.generateDraft).mockResolvedValue({ id: 22 } as any);

      await webhookHandler.handleEvent(tenant, app, event);

      expect(aiDraftService.generateDraft).toHaveBeenCalled();
      expect(aiDraftService.sendDraft).not.toHaveBeenCalled();
    });
  });

  describe('handleEvent - ticket_closed', () => {
    it('should update ticket state to closed', async () => {
      const event: WebhookEvent = {
        type: 'ticket_closed',
        ticketExternalId: 'conv-500',
        data: {},
      };

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 6 } as any);
      vi.mocked(ticketRepo.updateTicketState).mockResolvedValue({} as any);
      vi.mocked(messageRepo.findMessagesByTicketId).mockResolvedValue([]);

      await webhookHandler.handleEvent(tenant, app, event);

      expect(ticketRepo.updateTicketState).toHaveBeenCalledWith(1, 6, 'closed');
    });
  });

  describe('handleEvent - ticket_assigned', () => {
    it('should update ticket assignee', async () => {
      const event: WebhookEvent = {
        type: 'ticket_assigned',
        ticketExternalId: 'conv-600',
        data: { assigneeId: 'admin-99' },
      };

      vi.mocked(ticketRepo.upsertTicket).mockResolvedValue({ id: 7 } as any);
      vi.mocked(ticketRepo.updateTicketAssignee).mockResolvedValue({} as any);

      await webhookHandler.handleEvent(tenant, app, event);

      expect(ticketRepo.updateTicketAssignee).toHaveBeenCalledWith(1, 7, 'admin-99');
    });
  });
});
