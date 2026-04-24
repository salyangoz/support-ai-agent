import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from '../queues';
import * as tenantService from '../../services/tenant.service';
import * as appService from '../../services/app.service';
import * as appRepo from '../../repositories/app.repository';
import * as voiceIngestion from '../../services/voiceIngestion.service';
import { logger } from '../../utils/logger';

function isAuthError(err: any): boolean {
  const status = err?.response?.status || err?.status;
  return status === 401 || status === 403;
}

/**
 * Scanner: finds all active voice source apps and enqueues a sync job for each.
 */
export async function scanVoiceSync(_job: Job): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.SYNC_VOICE_APP);
  const tenants = await tenantService.getActiveTenants();
  let enqueued = 0;

  for (const tenant of tenants) {
    const apps = await appService.getApps(tenant.id, { type: 'voice', isActive: true });

    for (const app of apps) {
      if (app.role === 'destination') continue;

      await queue.add(
        'sync-voice-app',
        { tenantId: tenant.id, appId: app.id },
        {
          jobId: `sync-voice-${tenant.id}-${app.id}`,
          removeOnComplete: 100,
          removeOnFail: 200,
        },
      );
      enqueued++;
    }
  }

  return enqueued;
}

export async function processSyncVoiceApp(job: Job): Promise<voiceIngestion.VoiceSyncStats> {
  const { tenantId, appId } = job.data;

  try {
    const stats = await voiceIngestion.syncVoiceApp(tenantId, appId);
    await appRepo.markAppSynced(appId);
    return stats;
  } catch (err: any) {
    if (isAuthError(err)) {
      await appRepo.markAppAuthFailed(appId, 'Authentication failed');
      logger.error('Voice app deactivated due to auth failure', {
        tenantId,
        appId,
        error: err.message,
      });
    } else {
      await appRepo.markAppError(appId, err.message);
      logger.error('Voice sync failed for app', { tenantId, appId, error: err.message });
    }
    throw err;
  }
}
