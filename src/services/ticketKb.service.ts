import { chat as yengecChat } from '../lib/yengec-ai';
import { defaults } from '../config';
import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';
import * as knowledgeBaseService from './knowledgeBase.service';
import { Tenant, TenantSettings } from '../models/types';
import { logger } from '../utils/logger';

const MIN_MESSAGES = 3;

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function generateKbFromTicket(tenant: Tenant, ticketId: string) {
  const ticket = await ticketRepo.findTicketById(tenant.id, ticketId);
  if (!ticket) return null;

  const messages = await messageRepo.findMessagesByTicketId(ticketId, tenant.id);

  if (messages.length < MIN_MESSAGES) return null;

  const hasAgentReply = messages.some((m: any) => m.authorRole === 'agent');
  if (!hasAgentReply) return null;

  const conversation = messages
    .map((m: any) => `[${m.authorRole}]: ${m.body || ''}`)
    .join('\n');

  const aiResponse = await yengecChat({
    service: getSetting(tenant, 'ai_service', defaults.aiService),
    model: getSetting(tenant, 'ai_model', defaults.aiModel),
    instructions: [
      'You are a knowledge base article generator for a customer support system.',
      'Summarize the following customer support conversation into a knowledge base article.',
      'Write in the same language as the conversation.',
      'Format your response exactly as:\nQuestion: (the customer\'s problem in one clear sentence)\n\nResolution: (how it was resolved, step by step)\n\nTags: tag1, tag2, tag3',
    ],
    question: conversation,
    credentials: tenant.settings.ai_credentials,
  });

  const summary = aiResponse.text;
  const title = extractTitle(summary) || ticket.subject || 'Support Conversation';
  const tags = extractTags(summary);

  const article = await knowledgeBaseService.upsertArticleByExternalId(
    tenant.id,
    `ticket:${ticketId}`,
    {
      title,
      content: summary,
      category: tags[0] || 'support',
    },
  );

  return article;
}

export async function generateKbFromClosedTickets(tenant: Tenant) {
  const ticketIds = await ticketRepo.findClosedTicketsWithoutKbArticle(tenant.id);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const { id } of ticketIds) {
    try {
      const result = await generateKbFromTicket(tenant, id);
      if (result) {
        processed++;
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      logger.error('Failed to generate KB from ticket', {
        tenantId: tenant.id,
        ticketId: id,
        error: (err as Error).message,
      });
    }
  }

  return { processed, skipped, failed, total: ticketIds.length };
}

function extractTitle(summary: string): string | null {
  const match = summary.match(/(?:Question|Soru|Problem)\s*:\s*(.+)/i);
  return match ? match[1].trim() : null;
}

function extractTags(summary: string): string[] {
  const match = summary.match(/(?:Tags|Konu|Etiket)\s*:\s*(.+)/i);
  if (!match) return [];
  return match[1].split(',').map((t) => t.trim()).filter(Boolean);
}
