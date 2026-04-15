import { defaults } from '../config';
import { chat as yengecChat } from '../lib/yengec-ai';
import { embed } from './embedding.service';
import * as chunkRepo from '../repositories/knowledgeChunk.repository';
import * as articleRepo from '../repositories/knowledgeArticle.repository';
import { Tenant, TenantSettings } from '../models/types';

function getSetting<K extends keyof TenantSettings>(
  tenant: Tenant,
  key: K,
  fallback: any,
): any {
  return tenant.settings[key] ?? fallback;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResult {
  answer: string;
  sources: { chunkId: string; articleId: string; content: string }[];
  tokensUsed: number | null;
}

export async function chat(
  tenant: Tenant,
  question: string,
  history: ChatMessage[] = [],
): Promise<ChatResult> {
  const embedding = await embed(
    question,
    tenant.settings.embedding_credentials || tenant.settings.ai_credentials,
    getSetting(tenant, 'embedding_service', defaults.embeddingService),
    getSetting(tenant, 'embedding_model', defaults.embeddingModel),
  );
  const articleSummaries = await articleRepo.findActiveArticleSummaries(tenant.id);

  let sources: { id: string; article_id: string; content: string }[] = [];
  if (embedding) {
    const topK = getSetting(tenant, 'rag_top_k', defaults.ragTopK);
    sources = await chunkRepo.findSimilarChunks(tenant.id, embedding, topK);
  }

  const articleOverview = articleSummaries.length > 0
    ? `## Knowledge Base Overview (${articleSummaries.length} articles)\n`
      + articleSummaries.map((a) => `- [${a.category || 'general'}] ${a.title}`).join('\n')
    : '';

  const kbContext = sources.length > 0
    ? sources.map((c) => c.content).join('\n\n---\n\n')
    : '(No relevant knowledge base articles found)';

  const aiInstructions = getSetting(tenant, 'ai_instructions', '');
  const draftTone = getSetting(tenant, 'draft_tone', defaults.draftTone);

  const systemInstruction =
    `You are a helpful customer support agent. `
    + `Tone: ${draftTone}. `
    + (aiInstructions ? `Additional instructions: ${aiInstructions}` : '')
    + `\nAnswer the user's question using only the provided knowledge base context. `
    + `If the context does not contain the answer, say so honestly.`;

  const overviewInstruction = articleOverview
    ? `${articleOverview}\n\n## Relevant Knowledge Base Details\n${kbContext}`
    : `## Knowledge Base Context\n${kbContext}`;

  const historyInstructions = history.length > 0
    ? `## Conversation History\n${history.map((m) => `[${m.role}]: ${m.content}`).join('\n')}`
    : '';

  const instructions = [systemInstruction, overviewInstruction];
  if (historyInstructions) {
    instructions.push(historyInstructions);
  }

  const aiResponse = await yengecChat({
    service: getSetting(tenant, 'ai_service', defaults.aiService),
    model: getSetting(tenant, 'ai_model', defaults.aiModel),
    instructions,
    question,
    credentials: tenant.settings.ai_credentials,
  });

  return {
    answer: aiResponse.text,
    sources: sources.map((s) => ({
      chunkId: s.id,
      articleId: s.article_id,
      content: s.content,
    })),
    tokensUsed: aiResponse.tokensUsed,
  };
}
