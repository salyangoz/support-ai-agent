import { AxiosInstance } from 'axios';
import fs from 'fs';
import FormData from 'form-data';
import {
  TranscriptionApp,
  TranscriptionInput,
  TranscriptionResult,
  TranscriptionSegment,
} from '../app.interface';
import { createGladiaClient } from './gladia.http';
import {
  GladiaSubmitResponse,
  GladiaTranscriptionResult,
  GladiaUtterance,
} from './gladia.types';
import { logger } from '../../utils/logger';

const POLL_INTERVALS_MS = [2_000, 3_000, 5_000, 8_000, 10_000, 15_000];
const MIN_POLL_TIMEOUT_MS = 120_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GladiaConfig {
  apiKey: string;
  diarization?: boolean;
  detectLanguage?: boolean;
  defaultLanguage?: string;
  summarization?: boolean;
  sentimentAnalysis?: boolean;
  baseUrl?: string;
}

export class GladiaTranscriptionApp implements TranscriptionApp {
  private client: AxiosInstance;
  private diarization: boolean;
  private detectLanguage: boolean;
  private defaultLanguage: string;
  private summarization: boolean;
  private sentimentAnalysis: boolean;

  constructor(cfg: GladiaConfig) {
    this.client = createGladiaClient(cfg.apiKey, cfg.baseUrl);
    this.diarization = cfg.diarization ?? true;
    this.detectLanguage = cfg.detectLanguage ?? true;
    this.defaultLanguage = cfg.defaultLanguage || 'tr';
    this.summarization = cfg.summarization ?? true;
    this.sentimentAnalysis = cfg.sentimentAnalysis ?? false;
  }

  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const audioUrl = await this.resolveAudioUrl(input);
    if (!audioUrl) {
      throw new Error('Gladia: audioUrl or localFilePath is required');
    }

    const submitResponse = await this.submitPreRecorded(audioUrl, input);
    const resultUrl = submitResponse.result_url ?? `pre-recorded/${submitResponse.id}`;

    const polled = await this.pollUntilDone(resultUrl, input.durationSeconds);
    return this.mapResult(polled);
  }

  private async resolveAudioUrl(input: TranscriptionInput): Promise<string | null> {
    if (input.localFilePath) {
      return this.uploadLocalFile(input.localFilePath, input.mimeType);
    }
    if (input.audioAuthHeaders) {
      // Gladia's /pre-recorded cannot carry auth headers; caller should download first.
      // Returning null triggers the caller (voiceTranscription.service) to download to disk.
      return null;
    }
    return input.audioUrl ?? null;
  }

  private async uploadLocalFile(localFilePath: string, mimeType?: string): Promise<string> {
    const form = new FormData();
    form.append('audio', fs.createReadStream(localFilePath), {
      contentType: mimeType || 'audio/mpeg',
    });

    const response = await this.withRetry(() =>
      this.client.post('upload', form, {
        headers: form.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }),
    );

    const audioUrl = (response.data as Record<string, string> | null)?.audio_url;
    if (!audioUrl) {
      throw new Error('Gladia: upload did not return audio_url');
    }
    return audioUrl;
  }

  private async submitPreRecorded(
    audioUrl: string,
    input: TranscriptionInput,
  ): Promise<GladiaSubmitResponse> {
    const language = input.languageHint || this.defaultLanguage;

    const body: Record<string, unknown> = {
      audio_url: audioUrl,
      diarization: this.diarization,
      punctuation_enhanced: true,
      summarization: this.summarization,
      sentiment_analysis: this.sentimentAnalysis,
    };

    if (this.summarization) {
      body.summarization_config = { type: 'general' };
    }

    if (this.detectLanguage) {
      body.detect_language = true;
    } else {
      body.language = language;
      body.language_config = { languages: [language] };
    }

    if (this.diarization) {
      body.diarization_config = { enhanced: true };
    }

    const response = await this.withRetry(() => this.client.post<GladiaSubmitResponse>('pre-recorded', body));
    return response.data;
  }

  private async pollUntilDone(
    resultUrl: string,
    durationSeconds?: number,
  ): Promise<GladiaTranscriptionResult> {
    const absoluteUrl = /^https?:\/\//.test(resultUrl);
    const timeoutMs = Math.max(MIN_POLL_TIMEOUT_MS, (durationSeconds ?? 0) * 500);
    const startedAt = Date.now();
    let intervalIdx = 0;

    while (Date.now() - startedAt < timeoutMs) {
      const interval = POLL_INTERVALS_MS[Math.min(intervalIdx, POLL_INTERVALS_MS.length - 1)];
      await sleep(interval);
      intervalIdx++;

      const response = absoluteUrl
        ? await this.withRetry(() => this.client.get<GladiaTranscriptionResult>(resultUrl))
        : await this.withRetry(() => this.client.get<GladiaTranscriptionResult>(resultUrl));

      const data = response.data;
      if (data.status === 'done') return data;
      if (data.status === 'error') {
        throw new Error(`Gladia transcription error: ${data.error_message ?? 'unknown'}`);
      }
    }

    throw new Error(`Gladia transcription timed out after ${Math.round(timeoutMs / 1000)}s`);
  }

  private mapResult(result: GladiaTranscriptionResult): TranscriptionResult {
    const transcription = result.result?.transcription;
    const fullTranscript = transcription?.full_transcript?.trim() ?? '';
    const segments: TranscriptionSegment[] | undefined = transcription?.utterances?.map(
      (u: GladiaUtterance) => ({
        start: u.start,
        end: u.end,
        speaker: u.speaker !== undefined && u.speaker !== null ? String(u.speaker) : undefined,
        text: u.text,
      }),
    );

    const text = fullTranscript || (segments?.map((s) => s.text).join(' ').trim() ?? '');

    if (!text) {
      throw new Error('transcript_empty');
    }

    return {
      text,
      summary: result.result?.summarization?.results ?? undefined,
      language: transcription?.languages?.[0],
      durationSeconds: result.result?.metadata?.audio_duration,
      segments,
      raw: result,
    };
  }

  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (err: unknown) {
        const status = (err as { response?: { status?: number } })?.response?.status;
        attempt++;
        if (status === 429 && attempt < maxAttempts) {
          const delay = Math.min(1000 * attempt, 4000);
          logger.warn('Gladia rate limited; retrying', { attempt, delay });
          await sleep(delay);
          continue;
        }
        throw err;
      }
    }
  }
}
