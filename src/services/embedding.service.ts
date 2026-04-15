import { embed as yengecEmbed, AiCredentials } from '../lib/yengec-ai';
import { logger } from '../utils/logger';

export async function embed(
  text: string,
  credentials?: AiCredentials,
  service?: string,
  model?: string,
): Promise<number[] | null> {
  try {
    return await yengecEmbed({ text, credentials, service, model });
  } catch (error) {
    logger.error('Embedding request failed', { error });
    return null;
  }
}
