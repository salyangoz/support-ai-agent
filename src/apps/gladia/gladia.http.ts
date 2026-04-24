import axios, { AxiosInstance } from 'axios';

const DEFAULT_BASE_URL = 'https://api.gladia.io/v2/';

export function createGladiaClient(apiKey: string, baseUrl?: string): AxiosInstance {
  if (!apiKey) {
    throw new Error('Gladia api_key is required');
  }
  return axios.create({
    baseURL: baseUrl || DEFAULT_BASE_URL,
    headers: {
      'x-gladia-key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}
