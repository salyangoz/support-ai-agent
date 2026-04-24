import axios, { AxiosInstance } from 'axios';

const DEFAULT_BASE_URL = 'http://api.bulutsantralim.com/';

export function createVerimorClient(baseUrl?: string): AxiosInstance {
  return axios.create({
    baseURL: baseUrl || DEFAULT_BASE_URL,
    timeout: 60000,
  });
}
