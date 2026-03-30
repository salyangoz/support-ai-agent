import axios from 'axios';
import { config, defaults } from '../config';
import { embed } from './embedding.service';
import { createProvider } from '../providers/provider.factory';
import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';
import * as articleRepo from '../repositories/knowledgeArticle.repository';
import * as customerRepo from '../repositories/customer.repository';
import * as draftRepo from '../repositories/draft.repository';
import * as providerRepo from '../repositories/tenantProvider.repository';
import { Tenant, TenantSettings } from '../models/types';
import { logger } from '../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function generateDraft(tenant: Tenant, ticketId: number) {
  const ticket = await ticketRepo.findTicketById(tenant.id, ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  const messages = await messageRepo.findMessagesByTicketId(ticketId, tenant.id);
  const latestCustomerMessage = findLatestCustomerMessage(messages);
  if (!latestCustomerMessage) {
    throw new Error('No customer message found on ticket');
  }

  const embedding = await embed(latestCustomerMessage);
  const kbArticles = await findRelevantArticles(tenant, embedding);
  const pastReplies = await findPastReplies(tenant, embedding, ticketId);
  const customerContext = await buildCustomerContext(tenant.id, ticket.customer_id);
  const conversationContext = buildConversationContext(messages);

  const promptContext = assemblePromptContext(
    customerContext,
    kbArticles,
    pastReplies,
    conversationContext,
  );

  const aiResponse = await callAi(tenant, promptContext, latestCustomerMessage);

  const draft = await draftRepo.createDraft({
    ticketId,
    tenantId: tenant.id,
    promptContext,
    draftResponse: aiResponse.text,
    aiModel: getSetting(tenant, 'ai_model', defaults.aiModel),
    aiTokensUsed: aiResponse.tokensUsed,
  });

  return draft;
}

function findLatestCustomerMessage(messages: any[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].author_role === 'customer' && messages[i].body) {
      return messages[i].body;
    }
  }
  return null;
}

async function findRelevantArticles(tenant: Tenant, embedding: number[] | null) {
  if (!embedding) {
    return [];
  }

  const topK = getSetting(tenant, 'rag_top_k', defaults.ragTopK);
  return articleRepo.findSimilarArticles(tenant.id, embedding, topK);
}

async function findPastReplies(
  tenant: Tenant,
  embedding: number[] | null,
  ticketId: number,
) {
  if (!embedding) {
    return [];
  }

  return messageRepo.findSimilarAgentMessages(tenant.id, embedding, ticketId, 2);
}

async function buildCustomerContext(tenantId: number, customerId: number | null) {
  if (!customerId) {
    return null;
  }

  const customer = await customerRepo.findCustomerById(tenantId, customerId);
  if (!customer) {
    return null;
  }

  const previousTickets = await ticketRepo.findTicketsByTenantId(tenantId, {
    customerId,
    limit: 100,
  });
  const ticketCount = previousTickets.length;

  return { customer, ticketCount };
}

function buildConversationContext(messages: any[]): string {
  const recentMessages = messages.slice(-5);
  return recentMessages
    .map((m: any) => `[${m.author_role}]: ${m.body || '(no body)'}`)
    .join('\n');
}

function assemblePromptContext(
  customerCtx: { customer: any; ticketCount: number } | null,
  kbArticles: any[],
  pastReplies: any[],
  conversationContext: string,
): string {
  const sections: string[] = [];

  if (customerCtx) {
    const { customer, ticketCount } = customerCtx;
    sections.push(
      `## Customer Profile\nName: ${customer.name || 'Unknown'}\n`
      + `Email: ${customer.email || 'Unknown'}\n`
      + `Previous tickets: ${ticketCount}\n`
      + `Metadata: ${JSON.stringify(customer.metadata || {})}`,
    );
  }

  if (kbArticles.length > 0) {
    const articleTexts = kbArticles
      .map((a: any) => `### ${a.title}\n${a.content}`)
      .join('\n\n');
    sections.push(`## Knowledge Base Articles\n${articleTexts}`);
  }

  if (pastReplies.length > 0) {
    const replyTexts = pastReplies
      .map((r: any) => `Q: ${r.initial_body || '(no question)'}\nA: ${r.body}`)
      .join('\n\n');
    sections.push(`## Similar Past Replies\n${replyTexts}`);
  }

  sections.push(`## Current Conversation\n${conversationContext}`);

  return sections.join('\n\n');
}

async function callAi(
  tenant: Tenant,
  promptContext: string,
  latestCustomerMessage: string,
) {
  const aiInstructions = getSetting(tenant, 'ai_instructions', '');
  const draftTone = getSetting(tenant, 'draft_tone', defaults.draftTone);

  const systemInstruction =
    `You are a helpful customer support agent. `
    + `Tone: ${draftTone}. `
    + (aiInstructions ? `Additional instructions: ${aiInstructions}` : '');

  const contextInstruction = `Use the following context to draft a reply:\n\n${promptContext}`;

  const response = await axios.post(`${config.yengecAiBaseUrl}/chat`, {
    service: getSetting(tenant, 'ai_service', defaults.aiService),
    model: getSetting(tenant, 'ai_model', defaults.aiModel),
    instructions: [systemInstruction, contextInstruction],
    question: latestCustomerMessage,
  });

  return {
    text: response.data?.answer || response.data?.text || response.data,
    tokensUsed: response.data?.tokens_used || null,
  };
}

export async function sendDraft(tenant: Tenant, draftId: number) {
  const draft = await draftRepo.findDraftById(tenant.id, draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const ticket = await ticketRepo.findTicketById(tenant.id, draft.ticket_id);
  if (!ticket) {
    throw new Error(`Ticket ${draft.ticket_id} not found`);
  }

  const providerConfig = await providerRepo.findProvider(tenant.id, ticket.provider);
  if (!providerConfig) {
    throw new Error(`Provider config not found for ${ticket.provider}`);
  }

  const adapter = createProvider({ ...providerConfig.credentials, provider: providerConfig.provider });
  await adapter.sendReply(ticket.external_id, draft.draft_response);

  await draftRepo.updateDraftStatus(tenant.id, draftId, 'sent');

  logger.info('Draft sent', { tenantId: tenant.id, draftId, ticketId: draft.ticket_id });

  return draftRepo.findDraftById(tenant.id, draftId);
}
