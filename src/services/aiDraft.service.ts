import { defaults } from '../config';
import { chat as yengecChat } from '../lib/yengec-ai';
import { embed } from './embedding.service';
import { createOutputApp } from '../apps/app.factory';
import { resolveOutputApps } from '../apps/app.resolver';
import * as ticketRepo from '../repositories/ticket.repository';
import * as messageRepo from '../repositories/message.repository';
import * as chunkRepo from '../repositories/knowledgeChunk.repository';
import * as articleRepo from '../repositories/knowledgeArticle.repository';
import * as customerRepo from '../repositories/customer.repository';
import * as attachmentRepo from '../repositories/messageAttachment.repository';
import * as draftRepo from '../repositories/draft.repository';
import { Tenant, TenantSettings } from '../models/types';
import { logger } from '../utils/logger';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export async function generateDraft(tenant: Tenant, ticketId: string) {
  const ticket = await ticketRepo.findTicketById(tenant.id, ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${ticketId} not found`);
  }

  const messages = await messageRepo.findMessagesByTicketId(ticketId, tenant.id);

  // Skip draft if last message is not from customer
  const lastMessage = messages[messages.length - 1];
  if (lastMessage && lastMessage.authorRole !== 'customer') {
    return null;
  }

  const latestCustomerMessage = findLatestCustomerMessage(messages);
  if (!latestCustomerMessage) {
    throw new Error('No customer message found on ticket');
  }

  const embedding = await embed(
    latestCustomerMessage,
    tenant.settings.embedding_credentials || tenant.settings.ai_credentials,
    getSetting(tenant, 'embedding_service', defaults.embeddingService),
    getSetting(tenant, 'embedding_model', defaults.embeddingModel),
  );
  const kbArticles = await findRelevantArticles(tenant, embedding);
  const articleSummaries = await articleRepo.findActiveArticleSummaries(tenant.id);
  const pastReplies = await findPastReplies(tenant, embedding, ticketId);
  const customerContext = await buildCustomerContext(tenant.id, ticket.customerId);
  const conversationContext = buildConversationContext(messages);
  const textAttachments = await attachmentRepo.findTextAttachmentsByTicketId(ticketId, tenant.id);

  const promptContext = assemblePromptContext(
    customerContext,
    articleSummaries,
    kbArticles,
    pastReplies,
    conversationContext,
    textAttachments,
  );

  const aiResponse = await callAi(tenant, promptContext, latestCustomerMessage);

  const draft = await draftRepo.createDraft({
    ticketId,
    tenantId: tenant.id,
    promptContext,
    draftResponse: aiResponse.text,
    aiModel: getSetting(tenant, 'ai_model', defaults.aiModel),
    aiTokensUsed: aiResponse.tokensUsed ?? undefined,
  });

  return draft;
}

function findLatestCustomerMessage(messages: any[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].authorRole === 'customer' && messages[i].body) {
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
  return chunkRepo.findSimilarChunks(tenant.id, embedding, topK);
}

async function findPastReplies(
  tenant: Tenant,
  embedding: number[] | null,
  ticketId: string,
) {
  if (!embedding) {
    return [];
  }

  return messageRepo.findSimilarAgentMessages(tenant.id, embedding, ticketId, 2);
}

async function buildCustomerContext(tenantId: string, customerId: string | null) {
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
  const ticketCount = previousTickets.data.length;

  return { customer, ticketCount };
}

function buildConversationContext(messages: any[]): string {
  const recentMessages = messages.slice(-5);
  return recentMessages
    .map((m: any) => `[${m.authorRole}]: ${m.body || '(no body)'}`)
    .join('\n');
}

function assemblePromptContext(
  customerCtx: { customer: any; ticketCount: number } | null,
  articleSummaries: { id: string; title: string; category: string | null }[],
  kbArticles: any[],
  pastReplies: any[],
  conversationContext: string,
  textAttachments?: { fileName: string; fileType: string | null; contentText: string | null }[],
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

  if (articleSummaries.length > 0) {
    const list = articleSummaries
      .map((a) => `- [${a.category || 'general'}] ${a.title}`)
      .join('\n');
    sections.push(`## Knowledge Base Overview (${articleSummaries.length} articles)\n${list}`);
  }

  if (kbArticles.length > 0) {
    const chunkTexts = kbArticles
      .map((c: any) => c.content)
      .join('\n\n---\n\n');
    sections.push(`## Relevant Knowledge Base Details\n${chunkTexts}`);
  }

  if (pastReplies.length > 0) {
    const replyTexts = pastReplies
      .map((r: any) => `Q: ${r.initial_body || '(no question)'}\nA: ${r.body}`)
      .join('\n\n');
    sections.push(`## Similar Past Replies\n${replyTexts}`);
  }

  if (textAttachments && textAttachments.length > 0) {
    const attachmentTexts = textAttachments
      .filter((a) => a.contentText)
      .map((a) => `- [${a.fileName}]: ${a.contentText}`)
      .join('\n');
    if (attachmentTexts) {
      sections.push(`## Attachments\n${attachmentTexts}`);
    }
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

  return yengecChat({
    service: getSetting(tenant, 'ai_service', defaults.aiService),
    model: getSetting(tenant, 'ai_model', defaults.aiModel),
    instructions: [systemInstruction, contextInstruction],
    question: latestCustomerMessage,
    credentials: tenant.settings.ai_credentials,
  });
}

export async function sendDraft(tenant: Tenant, draftId: string) {
  const draft = await draftRepo.findDraftById(tenant.id, draftId);
  if (!draft) {
    throw new Error(`Draft ${draftId} not found`);
  }

  const ticket = await ticketRepo.findTicketById(tenant.id, draft.ticketId);
  if (!ticket) {
    throw new Error(`Ticket ${draft.ticketId} not found`);
  }

  const outputApps = await resolveOutputApps(
    tenant.id,
    ticket,
    tenant.settings,
  );

  // Fan-out: send to all resolved output apps in parallel
  const results = await Promise.allSettled(
    outputApps.map(async (app) => {
      const adapter = createOutputApp(app);
      await adapter.sendReply(ticket.externalId, draft.draftResponse);
      return app;
    }),
  );

  // Log results
  for (const result of results) {
    if (result.status === 'fulfilled') {
      logger.info('Draft sent', {
        tenantId: tenant.id,
        draftId,
        ticketId: draft.ticketId,
        appId: result.value.id,
        appCode: result.value.code,
      });
    } else {
      logger.error('Draft send failed to app', {
        tenantId: tenant.id,
        draftId,
        ticketId: draft.ticketId,
        error: result.reason?.message,
      });
    }
  }

  const anySuccess = results.some((r) => r.status === 'fulfilled');
  if (!anySuccess) {
    throw new Error('Failed to send draft to all output apps');
  }

  await draftRepo.updateDraftStatus(tenant.id, draftId, 'sent');

  return draftRepo.findDraftById(tenant.id, draftId);
}
