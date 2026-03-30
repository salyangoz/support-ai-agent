import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  adminApiKey: process.env.ADMIN_API_KEY || '',
  databaseUrl: process.env.DATABASE_URL || '',
  yengecAiBaseUrl: process.env.YENGEC_AI_BASE_URL || 'https://ai.yengec.co',
  logLevel: process.env.LOG_LEVEL || 'info',
};

export const defaults = {
  ragTopK: 5,
  embeddingDimension: 1536,
  syncLookbackMinutes: 10,
  aiService: 'deepseek',
  aiModel: 'deepseek-chat',
  autoSendDrafts: false,
  defaultLanguage: 'en',
  draftTone: 'professional',
  maxContextTokens: 4000,
};
