import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export async function embed(text: string): Promise<number[] | null> {
  try {
    const response = await axios.post(
      `${config.yengecAiBaseUrl}/embed`,
      { text },
      { timeout: 10_000 },
    );
    return response.data?.vector ?? response.data;
  } catch (error) {
    logger.error('Embedding request failed', { error });
    return null;
  }
}
