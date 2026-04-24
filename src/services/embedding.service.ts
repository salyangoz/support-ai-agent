import { embed as yengecEmbed, AiCredentials } from '../lib/yengec-ai';
import { logger } from '../utils/logger';

const MAX_RETRIES = 5;
const BASE_DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function embed(
  text: string,
  credentials?: AiCredentials,
  service?: string,
  model?: string,
): Promise<number[] | null> {
  let attempt = 0;
  while (attempt <= MAX_RETRIES) {
    try {
      return await yengecEmbed({ text, credentials, service, model });
    } catch (error) {
      const err = error as { response?: { status?: number }; message?: string };
      const status = err?.response?.status;

      const retryable = status === 429 || (typeof status === 'number' && status >= 500);
      if (retryable && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * 2 ** attempt;
        attempt++;
        logger.warn('Embedding retry on transient error', {
          status,
          attempt,
          delayMs: delay,
          service,
          model,
        });
        await sleep(delay);
        continue;
      }

      // Never log the full axios error — its `config.data` contains the request
      // body which includes the api_key. Log only status + message.
      logger.error('Embedding request failed', {
        status,
        message: err?.message,
        service,
        model,
        attempts: attempt + 1,
      });
      return null;
    }
  }
  return null;
}
