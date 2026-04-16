import axios, { AxiosInstance } from 'axios';

export interface AiCredentials {
  api_key?: string;
}

export interface ChatRequest {
  service: string;
  model: string;
  instructions: string[];
  question: string;
  credentials?: AiCredentials;
}

export interface ChatResponse {
  text: string;
  tokensUsed: number | null;
}

export interface EmbedRequest {
  text: string;
  service?: string;
  model?: string;
  credentials?: AiCredentials;
}

export interface YengecAiOptions {
  baseUrl?: string;
  timeout?: number;
}

const DEFAULT_BASE_URL = 'https://ai.yengec.co';
const DEFAULT_TIMEOUT = 60_000;

export class YengecAi {
  private client: AxiosInstance;

  constructor(options: YengecAiOptions = {}) {
    this.client = axios.create({
      baseURL: options.baseUrl || DEFAULT_BASE_URL,
      timeout: options.timeout || DEFAULT_TIMEOUT,
    });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const payload: Record<string, unknown> = {
      service: request.service,
      model: request.model,
      instructions: request.instructions,
      question: request.question,
    };

    if (request.credentials) {
      payload.credentials = request.credentials;
    }

    const response = await this.client.post('/chat', payload);

    const result = response.data?.data ?? response.data;

    return {
      text: result?.response || result?.answer || result?.text || result,
      tokensUsed: result?.cost || result?.tokens_used || null,
    };
  }

  async embed(request: EmbedRequest): Promise<number[] | null> {
    const payload: Record<string, unknown> = {
      text: request.text,
      service: request.service || 'chat-gpt',
      model: request.model || 'text-embedding-3-small',
    };

    if (request.credentials) {
      payload.credentials = request.credentials;
    }

    const response = await this.client.post('/embed', payload);
    return response.data?.data?.embedding ?? response.data?.vector ?? response.data;
  }
}

export default YengecAi;
