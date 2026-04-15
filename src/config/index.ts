import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '3001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || '',
  yengecAiBaseUrl: process.env.YENGEC_AI_BASE_URL || 'https://ai.yengec.co',
  sentryDsn: process.env.SENTRY_DSN || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  logLevel: process.env.LOG_LEVEL || 'info',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  uploadsDir: process.env.UPLOADS_DIR || 'uploads',
};

export const defaults = {
  ragTopK: 5,
  syncLookbackMinutes: 10,
  aiService: 'deepseek',
  aiModel: 'deepseek-chat',
  embeddingService: 'chat-gpt',
  embeddingModel: 'text-embedding-3-small',
  autoSendDrafts: false,
  defaultLanguage: 'en',
  draftTone: 'professional',
  maxContextTokens: 4000,
};
