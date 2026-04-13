import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import * as aiDraftService from '../../../src/services/aiDraft.service';
import * as ticketRepo from '../../../src/repositories/ticket.repository';
import * as messageRepo from '../../../src/repositories/message.repository';
import * as articleRepo from '../../../src/repositories/knowledgeArticle.repository';
import * as customerRepo from '../../../src/repositories/customer.repository';
import * as draftRepo from '../../../src/repositories/draft.repository';
import * as appRepo from '../../../src/repositories/app.repository';
import { Tenant } from '../../../src/models/types';

vi.mock('axios');
vi.mock('../../../src/repositories/ticket.repository');
vi.mock('../../../src/repositories/message.repository');
vi.mock('../../../src/repositories/knowledgeArticle.repository');
vi.mock('../../../src/repositories/customer.repository');
vi.mock('../../../src/repositories/draft.repository');
vi.mock('../../../src/repositories/app.repository');
vi.mock('../../../src/services/embedding.service', () => ({
  embed: vi.fn().mockResolvedValue([0.1, 0.2, 0.3]),
}));

const mockSendReply = vi.fn().mockResolvedValue(undefined);
vi.mock('../../../src/apps/app.factory', () => ({
  createOutputApp: vi.fn(() => ({ sendReply: mockSendReply })),
}));

const tenant: Tenant = {
  id: 1,
  name: 'Test',
  slug: 'test',
  apiKey: 'key',
  settings: { ai_model: 'test-model', ai_service: 'test-service' },
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('AiDraft Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDraft', () => {
    it('should generate a draft using RAG pipeline', async () => {
      vi.mocked(ticketRepo.findTicketById).mockResolvedValue({
        id: 1, tenantId: 1, customerId: 5, inputAppId: 10,
        outputAppId: null, externalId: 'ext-1',
      } as any);

      vi.mocked(messageRepo.findMessagesByTicketId).mockResolvedValue([
        { authorRole: 'customer', body: 'I need help with my order' },
        { authorRole: 'agent', body: 'Let me check' },
        { authorRole: 'customer', body: 'Order #123 is delayed' },
      ] as any);

      vi.mocked(articleRepo.findSimilarArticles).mockResolvedValue([
        { title: 'Shipping FAQ', content: 'Orders ship in 3-5 days' },
      ] as any);

      vi.mocked(messageRepo.findSimilarAgentMessages).mockResolvedValue([
        { body: 'I apologize for the delay', initial_body: 'My order is late' },
      ] as any);

      vi.mocked(customerRepo.findCustomerById).mockResolvedValue({
        id: 5, name: 'Jane', email: 'jane@test.com', metadata: { plan: 'premium' },
      } as any);

      vi.mocked(ticketRepo.findTicketsByTenantId).mockResolvedValue([{}, {}] as any);

      vi.mocked(axios.post).mockResolvedValue({
        data: {
          answer: 'Hi Jane, I see order #123 is delayed. Let me look into this.',
          tokens_used: 250,
        },
      });

      vi.mocked(draftRepo.createDraft).mockImplementation(async (data: any) => ({
        id: 1,
        ticketId: data.ticketId,
        tenantId: data.tenantId,
        draftResponse: data.draftResponse,
        promptContext: data.promptContext,
        aiModel: data.aiModel,
        aiTokensUsed: data.aiTokensUsed,
        status: 'pending',
      }));

      const draft = await aiDraftService.generateDraft(tenant, 1);

      expect(draft).toBeDefined();
      expect(draft.draftResponse).toBe('Hi Jane, I see order #123 is delayed. Let me look into this.');
      expect(draft.status).toBe('pending');
      expect(draft.aiModel).toBe('test-model');
      expect(draft.aiTokensUsed).toBe(250);

      // Verify AI was called with assembled context
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining('/chat'),
        expect.objectContaining({
          service: 'test-service',
          model: 'test-model',
          question: 'Order #123 is delayed',
        }),
      );

      // Verify prompt context includes KB articles and customer profile
      const createCall = vi.mocked(draftRepo.createDraft).mock.calls[0][0];
      expect(createCall.promptContext).toContain('Shipping FAQ');
      expect(createCall.promptContext).toContain('Jane');
      expect(createCall.promptContext).toContain('Previous tickets: 2');
    });

    it('should throw when ticket not found', async () => {
      vi.mocked(ticketRepo.findTicketById).mockResolvedValue(null);

      await expect(aiDraftService.generateDraft(tenant, 999))
        .rejects.toThrow('Ticket 999 not found');
    });

    it('should throw when no customer message exists', async () => {
      vi.mocked(ticketRepo.findTicketById).mockResolvedValue({ id: 1 } as any);
      vi.mocked(messageRepo.findMessagesByTicketId).mockResolvedValue([
        { authorRole: 'agent', body: 'Hello' },
      ] as any);

      await expect(aiDraftService.generateDraft(tenant, 1))
        .rejects.toThrow('No customer message found');
    });

    it('should handle missing customer gracefully', async () => {
      vi.mocked(ticketRepo.findTicketById).mockResolvedValue({
        id: 1, customerId: null,
      } as any);

      vi.mocked(messageRepo.findMessagesByTicketId).mockResolvedValue([
        { authorRole: 'customer', body: 'Help please' },
      ] as any);

      vi.mocked(articleRepo.findSimilarArticles).mockResolvedValue([]);
      vi.mocked(messageRepo.findSimilarAgentMessages).mockResolvedValue([]);

      vi.mocked(axios.post).mockResolvedValue({
        data: { answer: 'How can I help?', tokens_used: 50 },
      });

      vi.mocked(draftRepo.createDraft).mockImplementation(async (data: any) => ({
        id: 2, ...data, status: 'pending',
      }));

      const draft = await aiDraftService.generateDraft(tenant, 1);

      expect(draft).toBeDefined();
      expect(draft.draftResponse).toBe('How can I help?');
    });
  });

  describe('sendDraft', () => {
    it('should send draft to output app resolved from input app with role=both', async () => {
      vi.mocked(draftRepo.findDraftById)
        .mockResolvedValueOnce({
          id: 1, ticketId: 10, tenantId: 1, draftResponse: 'Here is your answer',
        } as any)
        .mockResolvedValueOnce({ id: 1, status: 'sent' } as any);

      vi.mocked(ticketRepo.findTicketById).mockResolvedValue({
        id: 10, externalId: 'conv-100', inputAppId: 20, outputAppId: null,
      } as any);

      vi.mocked(appRepo.findAppById).mockResolvedValue({
        id: 20, tenantId: 1, code: 'intercom', type: 'ticket', role: 'both',
        credentials: { accessToken: 'tok' }, isActive: true,
      } as any);

      vi.mocked(draftRepo.updateDraftStatus).mockResolvedValue({} as any);

      await aiDraftService.sendDraft(tenant, 1);

      expect(mockSendReply).toHaveBeenCalledWith('conv-100', 'Here is your answer');
      expect(draftRepo.updateDraftStatus).toHaveBeenCalledWith(1, 1, 'sent');
    });

    it('should throw when draft not found', async () => {
      vi.mocked(draftRepo.findDraftById).mockResolvedValue(null);

      await expect(aiDraftService.sendDraft(tenant, 999))
        .rejects.toThrow('Draft 999 not found');
    });

    it('should throw when ticket not found', async () => {
      vi.mocked(draftRepo.findDraftById).mockResolvedValue({
        id: 1, ticketId: 99, tenantId: 1, draftResponse: 'test',
      } as any);
      vi.mocked(ticketRepo.findTicketById).mockResolvedValue(null);

      await expect(aiDraftService.sendDraft(tenant, 1))
        .rejects.toThrow('Ticket 99 not found');
    });

    it('should throw when all output apps fail', async () => {
      vi.mocked(draftRepo.findDraftById).mockResolvedValue({
        id: 1, ticketId: 10, tenantId: 1, draftResponse: 'test',
      } as any);

      vi.mocked(ticketRepo.findTicketById).mockResolvedValue({
        id: 10, externalId: 'conv-100', inputAppId: 20, outputAppId: null,
      } as any);

      vi.mocked(appRepo.findAppById).mockResolvedValue({
        id: 20, tenantId: 1, code: 'intercom', type: 'ticket', role: 'both',
        isActive: true,
      } as any);

      mockSendReply.mockRejectedValueOnce(new Error('Intercom API down'));

      await expect(aiDraftService.sendDraft(tenant, 1))
        .rejects.toThrow('Failed to send draft to all output apps');
    });
  });
});
