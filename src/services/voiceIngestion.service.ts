import { defaults } from '../config';
import { createVoiceSourceApp } from '../apps/app.factory';
import * as appService from '../services/app.service';
import * as tenantService from '../services/tenant.service';
import * as voiceRepo from '../repositories/voiceRecording.repository';
import { matchCustomer } from './voiceCustomerMatch.service';
import { logger } from '../utils/logger';

export interface VoiceSyncStats {
  fetched: number;
  upserted: number;
  matched: number;
}

export async function syncVoiceApp(
  tenantId: string,
  voiceAppId: string,
): Promise<VoiceSyncStats> {
  const tenant = await tenantService.getTenantById(tenantId);
  if (!tenant) {
    throw new Error(`Tenant ${tenantId} not found`);
  }

  const app = await appService.getApp(tenantId, voiceAppId);
  if (!app) {
    throw new Error(`Voice app ${voiceAppId} not found`);
  }

  const adapter = createVoiceSourceApp(app as any);

  const sinceMinutes =
    (tenant.settings as Record<string, unknown>)?.sync_lookback_minutes != null
      ? Number((tenant.settings as Record<string, unknown>).sync_lookback_minutes)
      : defaults.syncLookbackMinutes;

  const recordings = await adapter.fetchRecentRecordings(
    Number.isFinite(sinceMinutes) ? sinceMinutes : defaults.syncLookbackMinutes,
  );

  let upserted = 0;
  let matched = 0;

  for (const recording of recordings) {
    try {
      const customer = await matchCustomer(tenantId, recording);
      if (customer) matched++;

      await voiceRepo.upsertVoiceRecording({
        tenantId,
        sourceAppId: app.id,
        externalId: recording.externalId,
        audioUrl: recording.audioUrl ?? null,
        audioAuthHeaders: recording.audioAuthHeaders ?? null,
        mimeType: recording.mimeType ?? null,
        durationSeconds: recording.durationSeconds ?? null,
        language: recording.language ?? null,
        caller: recording.caller ?? null,
        callee: recording.callee ?? null,
        direction: recording.direction ?? null,
        customerId: customer?.id ?? null,
        recordedAt: recording.recordedAt ?? null,
        metadata: {
          ...(recording.metadata ?? {}),
          caller_name: recording.callerName,
          voice_app_code: app.code,
          voice_app_id: app.id,
        },
      });
      upserted++;
    } catch (err) {
      logger.error('Failed to upsert voice recording', {
        tenantId,
        voiceAppId,
        externalId: recording.externalId,
        error: (err as Error).message,
      });
    }
  }

  logger.info('Voice sync complete', {
    tenantId,
    voiceAppId,
    voiceAppCode: app.code,
    fetched: recordings.length,
    upserted,
    matched,
  });

  return { fetched: recordings.length, upserted, matched };
}
