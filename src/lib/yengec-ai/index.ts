import { YengecAi } from '@yengec/ai';
import { config } from '../../config';

export type { AiCredentials, ChatRequest, ChatResponse, EmbedRequest } from '@yengec/ai';

const client = new YengecAi({
  baseUrl: config.yengecAiBaseUrl,
});

export const chat = client.chat.bind(client);
export const embed = client.embed.bind(client);
