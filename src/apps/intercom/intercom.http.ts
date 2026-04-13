import axios, { AxiosInstance } from 'axios';

export function createIntercomClient(accessToken: string): AxiosInstance {
  return axios.create({
    baseURL: 'https://api.intercom.io',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Intercom-Version': '2.11',
    },
    timeout: 15000,
  });
}
