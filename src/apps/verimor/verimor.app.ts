import { AxiosInstance } from 'axios';
import {
  NormalizedVoiceRecording,
  VoiceSourceApp,
} from '../app.interface';
import { createVerimorClient } from './verimor.http';
import { VerimorCdr, VerimorCdrResponse, VerimorDirection } from './verimor.types';
import { logger } from '../../utils/logger';

const DEFAULT_MIN_DURATION_SECONDS = 5;
const DEFAULT_MAX_RECORDINGS = 100;
const PAGE_LIMIT = 100;
const ANSWERED_RESULT = 'Cevaplandı';

function formatStamp(date: Date): string {
  // Verimor expects 'YYYY-MM-DD HH:MM:SS' in the tenant's operational timezone.
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

function parseStamp(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  // Verimor timestamps are "YYYY-MM-DD HH:MM:SS" without timezone. Parse as local.
  const match = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})$/.exec(value);
  if (!match) {
    const fallback = new Date(value);
    return Number.isNaN(fallback.getTime()) ? undefined : fallback;
  }
  const [, y, mo, d, h, mi, s] = match;
  return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
}

function parseDurationSeconds(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number') return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);
  // HH:MM:SS or MM:SS
  const parts = trimmed.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

/**
 * Format a Turkish phone number to E.164-ish '+90...' form.
 * Ported from app/Services/Crm/UserCallService::phoneFormatter in yengec-api.
 */
export function formatTurkishPhone(phone: string | undefined | null): string | undefined {
  if (!phone) return undefined;
  const trimmed = String(phone).trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith('+')) return trimmed;
  if (trimmed.startsWith('90')) return `+${trimmed}`;
  if (trimmed.startsWith('0')) return `+9${trimmed}`;
  if (trimmed.startsWith('5')) return `+90${trimmed}`;
  return trimmed;
}

interface VerimorConfig {
  apiKey: string;
  minDurationSeconds?: number;
  maxRecordings?: number;
  baseUrl?: string;
}

export class VerimorVoiceApp implements VoiceSourceApp {
  private client: AxiosInstance;
  private apiKey: string;
  private minDuration: number;
  private maxRecordings: number;

  constructor(cfg: VerimorConfig) {
    if (!cfg.apiKey) {
      throw new Error('Verimor api_key is required');
    }
    this.client = createVerimorClient(cfg.baseUrl);
    this.apiKey = cfg.apiKey;
    this.minDuration =
      typeof cfg.minDurationSeconds === 'number' && cfg.minDurationSeconds >= 0
        ? cfg.minDurationSeconds
        : DEFAULT_MIN_DURATION_SECONDS;
    this.maxRecordings =
      typeof cfg.maxRecordings === 'number' && cfg.maxRecordings > 0
        ? cfg.maxRecordings
        : DEFAULT_MAX_RECORDINGS;
  }

  async fetchRecentRecordings(sinceMinutes: number): Promise<NormalizedVoiceRecording[]> {
    const now = new Date();
    const since = new Date(now.getTime() - Math.max(1, sinceMinutes) * 60 * 1000);

    const [inbound, outbound] = await Promise.all([
      this.fetchAllCdrs(since, now, 'inbound'),
      this.fetchAllCdrs(since, now, 'outbound'),
    ]);

    const dedup = new Map<string, VerimorCdr>();
    for (const cdr of [...inbound, ...outbound]) {
      if (!cdr.call_uuid) continue;
      if (!dedup.has(cdr.call_uuid)) dedup.set(cdr.call_uuid, cdr);
    }

    const recordings: NormalizedVoiceRecording[] = [];
    for (const cdr of dedup.values()) {
      if (recordings.length >= this.maxRecordings) break;
      const normalized = await this.normalize(cdr);
      if (normalized) recordings.push(normalized);
    }
    return recordings;
  }

  private async fetchAllCdrs(
    start: Date,
    end: Date,
    direction: VerimorDirection,
  ): Promise<VerimorCdr[]> {
    const all: VerimorCdr[] = [];
    let page = 1;
    let totalPages = 1;

    do {
      const response = await this.client.get<VerimorCdrResponse | Record<string, unknown>>('cdrs', {
        params: {
          key: this.apiKey,
          start_stamp_from: formatStamp(start),
          start_stamp_to: formatStamp(end),
          direction,
          limit: PAGE_LIMIT,
          page,
        },
      });

      const data = (response.data ?? {}) as Record<string, unknown>;

      // Bulutsantralim returns HTTP 200 with an error body on bad api_key.
      // A valid success response always contains at least `cdrs` or `pagination`.
      if (!('cdrs' in data) && !('pagination' in data)) {
        const authError =
          typeof data.error === 'string' ||
          typeof data.message === 'string' ||
          typeof (data as { error_message?: unknown }).error_message === 'string';
        const detail =
          (data.error as string | undefined) ||
          (data.message as string | undefined) ||
          ((data as { error_message?: string }).error_message) ||
          'invalid response shape';
        const err = new Error(`Verimor rejected request: ${detail}`);
        if (authError) {
          (err as Error & { response?: { status: number } }).response = { status: 401 };
        }
        throw err;
      }

      const cdrs = Array.isArray((data as VerimorCdrResponse).cdrs)
        ? ((data as VerimorCdrResponse).cdrs as VerimorCdr[])
        : [];
      all.push(...cdrs);

      totalPages = (data as VerimorCdrResponse).pagination?.total_pages ?? page;
      page++;
    } while (page <= totalPages && all.length < this.maxRecordings);

    return all;
  }

  private async normalize(cdr: VerimorCdr): Promise<NormalizedVoiceRecording | null> {
    const directionRaw = (cdr.direction || '').toString().toLowerCase();
    const direction: 'inbound' | 'outbound' =
      directionRaw === 'giden' || directionRaw === 'outbound' ? 'outbound' : 'inbound';

    // Skip missed/unanswered — no recording available.
    if (cdr.missed) {
      return null;
    }
    if (cdr.result && cdr.result !== ANSWERED_RESULT) {
      return null;
    }

    const durationSeconds =
      parseDurationSeconds(cdr.talk_duration) ?? parseDurationSeconds(cdr.duration);

    if (!durationSeconds || durationSeconds < this.minDuration) {
      return null;
    }

    const callerNumber =
      direction === 'outbound'
        ? cdr.destination_number
        : cdr.caller_id_number;
    const calleeNumber =
      direction === 'outbound'
        ? cdr.caller_id_number
        : cdr.destination_number;

    const audioUrl = await this.fetchRecordingUrl(cdr.call_uuid);
    if (!audioUrl) return null;

    return {
      externalId: cdr.call_uuid,
      audioUrl,
      mimeType: 'audio/mpeg',
      durationSeconds,
      recordedAt: parseStamp(cdr.start_stamp),
      language: 'tr',
      caller: formatTurkishPhone(callerNumber ?? undefined) ?? callerNumber ?? undefined,
      callee: formatTurkishPhone(calleeNumber ?? undefined) ?? calleeNumber ?? undefined,
      direction,
      callerName: cdr.caller_id_name ?? undefined,
      metadata: {
        queue: cdr.queue ?? undefined,
        destination_name: cdr.destination_name ?? undefined,
        result: cdr.result ?? undefined,
        answer_stamp: cdr.answer_stamp ?? undefined,
        queue_wait_seconds:
          cdr.queue_wait_seconds !== undefined ? cdr.queue_wait_seconds : undefined,
        raw_direction: cdr.direction ?? undefined,
      },
    };
  }

  private async fetchRecordingUrl(callUuid: string): Promise<string | null> {
    try {
      const response = await this.client.post('recording_url', {
        key: this.apiKey,
        call_uuid: callUuid,
      });
      const body = response.data;
      if (!body) return null;
      // The PHP client returns $response->getBody() directly — the body is
      // usually a bare URL or a JSON-encoded string.
      if (typeof body === 'string') return body.replace(/^"|"$/g, '') || null;
      if (typeof body === 'object' && body !== null) {
        const candidate = (body as Record<string, unknown>).url || (body as Record<string, unknown>).recording_url;
        if (typeof candidate === 'string') return candidate;
      }
      return null;
    } catch (err) {
      logger.warn('Verimor recording_url fetch failed', {
        callUuid,
        error: (err as Error).message,
      });
      return null;
    }
  }
}
