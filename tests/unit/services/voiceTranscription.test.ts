import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../../src/services/app.service', () => ({
  getApps: vi.fn(),
  getApp: vi.fn(),
}));
vi.mock('../../../src/services/tenant.service', () => ({ getTenantById: vi.fn() }));
vi.mock('../../../src/repositories/voiceRecording.repository', () => ({
  findVoiceRecordingById: vi.fn(),
  markTranscribing: vi.fn(),
  markTranscribed: vi.fn(),
  markTranscriptionFailed: vi.fn(),
}));
vi.mock('../../../src/repositories/customer.repository', () => ({
  findCustomerById: vi.fn(),
}));
vi.mock('../../../src/services/knowledgeBase.service', () => ({
  upsertArticleByExternalId: vi.fn(),
}));
vi.mock('../../../src/apps/app.factory', () => ({
  createTranscriptionApp: vi.fn(),
}));

import * as appService from '../../../src/services/app.service';
import * as voiceRepo from '../../../src/repositories/voiceRecording.repository';
import * as customerRepo from '../../../src/repositories/customer.repository';
import * as kbService from '../../../src/services/knowledgeBase.service';
import { createTranscriptionApp } from '../../../src/apps/app.factory';
import {
  pickTranscriberForTenant,
  transcribeRecording,
} from '../../../src/services/voiceTranscription.service';

const TENANT = 't1';

describe('pickTranscriberForTenant', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns null when no active transcription apps', async () => {
    vi.mocked(appService.getApps).mockResolvedValue([]);
    expect(await pickTranscriberForTenant(TENANT)).toBeNull();
  });

  it('returns the single active transcription app', async () => {
    const app = { id: 'a1', code: 'gladia', createdAt: new Date('2026-01-01') };
    vi.mocked(appService.getApps).mockResolvedValue([app] as any);
    const res = await pickTranscriberForTenant(TENANT);
    expect(res?.id).toBe('a1');
  });

  it('picks the oldest when multiple are active and warns', async () => {
    const apps = [
      { id: 'a2', code: 'gladia', createdAt: new Date('2026-02-01') },
      { id: 'a1', code: 'gladia', createdAt: new Date('2026-01-01') },
    ];
    vi.mocked(appService.getApps).mockResolvedValue(apps as any);
    const res = await pickTranscriberForTenant(TENANT);
    expect(res?.id).toBe('a1');
  });
});

describe('transcribeRecording', () => {
  beforeEach(() => vi.clearAllMocks());

  const baseRecording = {
    id: 'r1',
    tenantId: TENANT,
    sourceAppId: 'voice-app-1',
    externalId: 'ext-1',
    audioUrl: 'https://audio.example/r1.mp3',
    audioAuthHeaders: null,
    mimeType: 'audio/mpeg',
    durationSeconds: 60,
    language: 'tr',
    caller: '+905551234567',
    callee: null,
    direction: 'inbound' as const,
    customerId: null,
    transcriptionStatus: 'pending' as const,
    transcriptionError: null,
    transcriptionAttempts: 0,
    articleId: null,
    metadata: {},
    recordedAt: new Date('2026-04-24T10:00:00Z'),
    transcribedAt: null,
    createdAt: new Date('2026-04-24T10:00:00Z'),
  };

  it('marks failed when no active transcriber is available', async () => {
    vi.mocked(voiceRepo.findVoiceRecordingById).mockResolvedValue({ ...baseRecording });
    vi.mocked(appService.getApps).mockResolvedValue([]);

    await transcribeRecording(TENANT, 'r1');

    expect(voiceRepo.markTranscribing).toHaveBeenCalledWith('r1');
    expect(voiceRepo.markTranscriptionFailed).toHaveBeenCalledWith('r1', 'no_active_transcriber');
    expect(voiceRepo.markTranscribed).not.toHaveBeenCalled();
  });

  it('happy path: transcribes and upserts a KB article with voice metadata', async () => {
    vi.mocked(voiceRepo.findVoiceRecordingById).mockResolvedValue({ ...baseRecording });
    vi.mocked(appService.getApps).mockResolvedValue([
      { id: 'gladia-1', code: 'gladia', createdAt: new Date('2026-01-01'), type: 'transcription' },
    ] as any);
    vi.mocked(appService.getApp).mockResolvedValue({
      id: 'voice-app-1', code: 'verimor', name: 'Verimor', type: 'voice',
    } as any);
    vi.mocked(customerRepo.findCustomerById).mockResolvedValue(null);

    const mockAdapter = {
      transcribe: vi.fn().mockResolvedValue({
        text: 'Merhaba ne yapmalıyım?',
        summary: 'Müşteri yardım istiyor',
        segments: [
          { start: 0, end: 2, speaker: '0', text: 'Merhaba' },
          { start: 2, end: 5, speaker: '1', text: 'Nasıl yardımcı olabilirim?' },
        ],
        language: 'tr',
      }),
    };
    vi.mocked(createTranscriptionApp).mockReturnValue(mockAdapter as any);

    vi.mocked(kbService.upsertArticleByExternalId).mockResolvedValue({ id: 'article-1' } as any);

    await transcribeRecording(TENANT, 'r1');

    expect(mockAdapter.transcribe).toHaveBeenCalledWith(
      expect.objectContaining({
        audioUrl: 'https://audio.example/r1.mp3',
        languageHint: 'tr',
        durationSeconds: 60,
      }),
    );

    expect(kbService.upsertArticleByExternalId).toHaveBeenCalledWith(
      TENANT,
      'verimor:ext-1',
      expect.objectContaining({
        sourceType: 'voice',
        category: 'voice',
        metadata: expect.objectContaining({
          voice_app_code: 'verimor',
          transcriber_app_code: 'gladia',
          caller: '+905551234567',
          direction: 'inbound',
          duration_seconds: 60,
          summary: 'Müşteri yardım istiyor',
        }),
      }),
    );

    expect(voiceRepo.markTranscribed).toHaveBeenCalledWith('r1', { articleId: 'article-1' });
  });

  it('marks failed with empty_transcript when adapter throws transcript_empty', async () => {
    vi.mocked(voiceRepo.findVoiceRecordingById).mockResolvedValue({ ...baseRecording });
    vi.mocked(appService.getApps).mockResolvedValue([
      { id: 'gladia-1', code: 'gladia', createdAt: new Date('2026-01-01'), type: 'transcription' },
    ] as any);
    vi.mocked(appService.getApp).mockResolvedValue({
      id: 'voice-app-1', code: 'verimor', name: 'Verimor', type: 'voice',
    } as any);
    const mockAdapter = {
      transcribe: vi.fn().mockRejectedValue(new Error('transcript_empty')),
    };
    vi.mocked(createTranscriptionApp).mockReturnValue(mockAdapter as any);

    await transcribeRecording(TENANT, 'r1');

    expect(voiceRepo.markTranscriptionFailed).toHaveBeenCalledWith('r1', 'empty_transcript');
    expect(kbService.upsertArticleByExternalId).not.toHaveBeenCalled();
    expect(voiceRepo.markTranscribed).not.toHaveBeenCalled();
  });

  it('skips recordings not in pending/failed status', async () => {
    vi.mocked(voiceRepo.findVoiceRecordingById).mockResolvedValue({
      ...baseRecording,
      transcriptionStatus: 'done' as const,
    });

    await transcribeRecording(TENANT, 'r1');

    expect(voiceRepo.markTranscribing).not.toHaveBeenCalled();
  });
});
