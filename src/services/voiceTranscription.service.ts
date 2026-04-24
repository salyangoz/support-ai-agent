import path from 'path';
import { TranscriptionInput, TranscriptionResult } from '../apps/app.interface';
import { createTranscriptionApp } from '../apps/app.factory';
import { App, VoiceArticleMetadata } from '../models/types';
import * as appService from '../services/app.service';
import * as tenantService from '../services/tenant.service';
import * as customerRepo from '../repositories/customer.repository';
import * as voiceRepo from '../repositories/voiceRecording.repository';
import * as knowledgeBaseService from './knowledgeBase.service';
import * as fileStorage from './fileStorage.service';
import { logger } from '../utils/logger';

export async function pickTranscriberForTenant(tenantId: string): Promise<App | null> {
  const apps = await appService.getApps(tenantId, { type: 'transcription', isActive: true });
  if (apps.length === 0) return null;
  const sorted = [...apps].sort((a, b) => {
    const at = (a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt as any).getTime()) || 0;
    const bt = (b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt as any).getTime()) || 0;
    return at - bt;
  });
  const chosen = sorted[0];
  if (sorted.length > 1) {
    logger.warn('Multiple active transcription apps; using first', {
      tenantId,
      count: sorted.length,
      chosenId: chosen.id,
      chosenCode: chosen.code,
    });
  }
  return chosen as any;
}

function formatUtterances(segments: TranscriptionResult['segments']): string | null {
  if (!segments || segments.length === 0) return null;
  const hasSpeakers = segments.some((s) => s.speaker !== undefined);
  if (!hasSpeakers) return null;
  return segments
    .map((s) => {
      const speaker = s.speaker ?? 'Unknown';
      return `**Speaker ${speaker}:** ${s.text.trim()}`;
    })
    .join('\n\n');
}

function formatTitle(recording: Awaited<ReturnType<typeof voiceRepo.findVoiceRecordingById>>, voiceApp: App): string {
  if (!recording) return 'Voice recording';
  const parts: string[] = [];
  if (recording.caller) parts.push(`Call from ${recording.caller}`);
  else parts.push(`${voiceApp.name || voiceApp.code} call`);
  const when = recording.recordedAt ? recording.recordedAt : recording.createdAt;
  if (when) parts.push(new Date(when).toISOString().slice(0, 19).replace('T', ' '));
  return parts.join(' — ').slice(0, 500);
}

export async function transcribeRecording(tenantId: string, recordingId: string): Promise<void> {
  const recording = await voiceRepo.findVoiceRecordingById(tenantId, recordingId);
  if (!recording) {
    logger.warn('Transcription skipped: recording not found', { tenantId, recordingId });
    return;
  }
  if (recording.transcriptionStatus !== 'pending' && recording.transcriptionStatus !== 'failed') {
    return;
  }
  if (!recording.audioUrl && !recording.audioAuthHeaders) {
    await voiceRepo.markTranscriptionFailed(recording.id, 'missing_audio_url');
    return;
  }

  await voiceRepo.markTranscribing(recording.id);

  let localFilePathToCleanup: string | null = null;

  try {
    const transcriber = await pickTranscriberForTenant(tenantId);
    if (!transcriber) {
      await voiceRepo.markTranscriptionFailed(recording.id, 'no_active_transcriber');
      return;
    }

    const voiceApp = (await appService.getApp(tenantId, recording.sourceAppId)) as App | null;
    if (!voiceApp) {
      await voiceRepo.markTranscriptionFailed(recording.id, 'voice_app_not_found');
      return;
    }

    const adapter = createTranscriptionApp(transcriber);

    const transcriptionInput: TranscriptionInput = {
      languageHint: recording.language ?? undefined,
      durationSeconds: recording.durationSeconds ?? undefined,
      mimeType: recording.mimeType ?? undefined,
    };

    if (recording.audioAuthHeaders && recording.audioUrl) {
      // Download to local disk so we can upload to the transcriber.
      const headers = recording.audioAuthHeaders as Record<string, string>;
      const relative = await fileStorage.downloadAndStore(
        tenantId,
        recording.audioUrl,
        path.basename(new URL(recording.audioUrl).pathname) || `voice-${recording.id}.mp3`,
        recording.mimeType ?? 'audio/mpeg',
        { headers, subdir: 'voice' },
      );
      if (!relative) {
        await voiceRepo.markTranscriptionFailed(recording.id, 'audio_download_failed');
        return;
      }
      localFilePathToCleanup = relative;
      transcriptionInput.localFilePath = fileStorage.getAbsolutePath(relative);
    } else if (recording.audioUrl) {
      transcriptionInput.audioUrl = recording.audioUrl;
    }

    let result: TranscriptionResult;
    try {
      result = await adapter.transcribe(transcriptionInput);
    } catch (err) {
      const message = (err as Error).message || 'transcription_failed';
      if (message === 'transcript_empty') {
        await voiceRepo.markTranscriptionFailed(recording.id, 'empty_transcript');
        return;
      }
      await voiceRepo.markTranscriptionFailed(recording.id, message);
      throw err;
    }

    const diarized = formatUtterances(result.segments);
    const content = diarized || result.text;
    const title = formatTitle(recording, voiceApp);

    const customer = recording.customerId
      ? await customerRepo.findCustomerById(tenantId, recording.customerId)
      : null;

    const articleMetadata: VoiceArticleMetadata & { segments?: TranscriptionResult['segments'] } = {
      audio_url: recording.audioUrl ?? undefined,
      duration_seconds: recording.durationSeconds ?? result.durationSeconds ?? undefined,
      language: result.language ?? recording.language ?? undefined,
      recorded_at: recording.recordedAt ? recording.recordedAt.toISOString() : undefined,
      voice_app_code: voiceApp.code,
      voice_app_id: voiceApp.id,
      transcriber_app_code: transcriber.code,
      transcriber_app_id: transcriber.id,
      transcriber_confidence: result.confidence,
      caller: recording.caller ?? undefined,
      callee: recording.callee ?? undefined,
      direction: (recording.direction as 'inbound' | 'outbound' | undefined) ?? undefined,
      customer_id: customer?.id,
      customer_email: customer?.email ?? undefined,
      customer_name: customer?.name ?? undefined,
      customer_phone: customer?.phone ?? undefined,
      summary: result.summary,
    };

    const externalId = `${voiceApp.code}:${recording.externalId}`;

    const article = await knowledgeBaseService.upsertArticleByExternalId(
      tenantId,
      externalId,
      {
        title,
        content,
        category: 'voice',
        sourceType: 'voice',
        metadata: articleMetadata as unknown as Record<string, unknown>,
      },
    );

    if (!article) {
      await voiceRepo.markTranscriptionFailed(recording.id, 'article_upsert_failed');
      return;
    }

    await voiceRepo.markTranscribed(recording.id, { articleId: article.id });

    logger.info('Voice recording transcribed', {
      tenantId,
      recordingId: recording.id,
      voiceAppCode: voiceApp.code,
      transcriberCode: transcriber.code,
      articleId: article.id,
      durationSeconds: recording.durationSeconds,
      hasSegments: !!result.segments?.length,
    });
  } finally {
    if (localFilePathToCleanup) {
      await fileStorage.deleteLocalFile(localFilePathToCleanup);
    }
  }
}
