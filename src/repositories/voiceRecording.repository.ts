import { getPrisma } from '../database/prisma';
import { generateId } from '../utils/uuid';
import { buildPaginatedResult } from '../utils/pagination';
import { TranscriptionStatus } from '../models/types';

const MAX_TRANSCRIPTION_ATTEMPTS = 3;

export interface UpsertVoiceRecordingInput {
  tenantId: string;
  sourceAppId: string;
  externalId: string;
  audioUrl?: string | null;
  audioAuthHeaders?: Record<string, string> | null;
  mimeType?: string | null;
  durationSeconds?: number | null;
  language?: string | null;
  caller?: string | null;
  callee?: string | null;
  direction?: 'inbound' | 'outbound' | null;
  customerId?: string | null;
  metadata?: Record<string, unknown>;
  recordedAt?: Date | null;
}

export async function upsertVoiceRecording(input: UpsertVoiceRecordingInput) {
  const existing = await getPrisma().voiceRecording.findUnique({
    where: {
      tenantId_sourceAppId_externalId: {
        tenantId: input.tenantId,
        sourceAppId: input.sourceAppId,
        externalId: input.externalId,
      },
    },
  });

  if (existing) {
    // Refresh metadata-ish fields but don't reset pipeline state.
    return getPrisma().voiceRecording.update({
      where: { id: existing.id },
      data: {
        audioUrl: input.audioUrl ?? existing.audioUrl,
        audioAuthHeaders: (input.audioAuthHeaders ?? existing.audioAuthHeaders) as any,
        mimeType: input.mimeType ?? existing.mimeType,
        durationSeconds: input.durationSeconds ?? existing.durationSeconds,
        language: input.language ?? existing.language,
        caller: input.caller ?? existing.caller,
        callee: input.callee ?? existing.callee,
        direction: input.direction ?? existing.direction,
        customerId: input.customerId ?? existing.customerId,
        metadata: (input.metadata ?? (existing.metadata as any)) as any,
        recordedAt: input.recordedAt ?? existing.recordedAt,
      },
    });
  }

  return getPrisma().voiceRecording.create({
    data: {
      id: generateId(),
      tenantId: input.tenantId,
      sourceAppId: input.sourceAppId,
      externalId: input.externalId,
      audioUrl: input.audioUrl ?? null,
      audioAuthHeaders: (input.audioAuthHeaders ?? null) as any,
      mimeType: input.mimeType ?? null,
      durationSeconds: input.durationSeconds ?? null,
      language: input.language ?? null,
      caller: input.caller ?? null,
      callee: input.callee ?? null,
      direction: input.direction ?? null,
      customerId: input.customerId ?? null,
      metadata: (input.metadata ?? {}) as any,
      recordedAt: input.recordedAt ?? null,
    },
  });
}

export async function findVoiceRecordingById(tenantId: string, id: string) {
  return getPrisma().voiceRecording.findFirst({
    where: { tenantId, id },
  });
}

export async function findPendingVoiceRecordings(tenantId: string, limit: number) {
  return getPrisma().voiceRecording.findMany({
    where: {
      tenantId,
      transcriptionStatus: { in: ['pending', 'failed'] },
      transcriptionAttempts: { lt: MAX_TRANSCRIPTION_ATTEMPTS },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });
}

export async function listVoiceRecordings(
  tenantId: string,
  filters?: { status?: TranscriptionStatus; cursor?: string; limit?: number },
) {
  const limit = filters?.limit ?? 20;
  const where: Record<string, unknown> = { tenantId };
  if (filters?.status) where.transcriptionStatus = filters.status;

  const countWhere = { ...where };
  if (filters?.cursor) where.id = { lt: filters.cursor };

  const total = await getPrisma().voiceRecording.count({ where: countWhere });
  const items = await getPrisma().voiceRecording.findMany({
    where,
    orderBy: { id: 'desc' },
    take: limit,
    include: { customer: true },
  });

  return buildPaginatedResult(items, total, limit);
}

export async function markTranscribing(id: string) {
  return getPrisma().voiceRecording.update({
    where: { id },
    data: {
      transcriptionStatus: 'transcribing',
      transcriptionAttempts: { increment: 1 },
      transcriptionError: null,
    },
  });
}

export async function markTranscribed(
  id: string,
  data: { articleId: string; metadata?: Record<string, unknown> },
) {
  return getPrisma().voiceRecording.update({
    where: { id },
    data: {
      transcriptionStatus: 'done',
      transcriptionError: null,
      articleId: data.articleId,
      transcribedAt: new Date(),
      ...(data.metadata ? { metadata: data.metadata as any } : {}),
    },
  });
}

export async function markTranscriptionFailed(id: string, error: string) {
  return getPrisma().voiceRecording.update({
    where: { id },
    data: {
      transcriptionStatus: 'failed',
      transcriptionError: error.slice(0, 10_000),
    },
  });
}

export async function resetForRetry(tenantId: string, id: string) {
  const existing = await findVoiceRecordingById(tenantId, id);
  if (!existing) return null;
  return getPrisma().voiceRecording.update({
    where: { id },
    data: {
      transcriptionStatus: 'pending',
      transcriptionError: null,
      transcriptionAttempts: 0,
    },
  });
}
