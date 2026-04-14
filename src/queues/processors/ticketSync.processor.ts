import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from '../queues';
import * as tenantService from '../../services/tenant.service';
import * as appService from '../../services/app.service';
import * as appRepo from '../../repositories/app.repository';
import * as ticketSyncService from '../../services/ticketSync.service';
import { logger } from '../../utils/logger';

function isAuthError(err: any): boolean {
  const status = err?.response?.status || err?.status;
  return status === 401 || status === 403;
}

/**
 * Scanner: finds all active tenant+app pairs and enqueues a sync job for each.
 */
export async function scanTicketSync(job: Job): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.SYNC_TENANT_APP);
  const tenants = await tenantService.getActiveTenants();
  let enqueued = 0;

  for (const tenant of tenants) {
    const inputApps = await appService.getActiveInputApps(tenant.id);

    for (const app of inputApps) {
      await queue.add('sync-tenant-app', {
        tenantId: tenant.id,
        appId: app.id,
      }, {
        jobId: `sync-${tenant.id}-${app.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      enqueued++;
    }
  }

  return enqueued;
}

/**
 * Worker: syncs one tenant+app pair. Reports health status.
 */
export async function processSyncTenantApp(job: Job): Promise<void> {
  const { tenantId, appId } = job.data;

  const tenant = await tenantService.getTenantById(tenantId);
  if (!tenant) return;

  const app = await appService.getApp(tenantId, appId);
  if (!app) return;

  try {
    await ticketSyncService.syncInputApp(tenant as any, app as any);
    await appRepo.markAppSynced(appId);
  } catch (err: any) {
    if (isAuthError(err)) {
      await appRepo.markAppAuthFailed(appId, 'Authentication failed');
      logger.error(`App deactivated due to auth failure`, { tenantId, appId, error: err.message });
    } else {
      await appRepo.markAppError(appId, err.message);
      logger.error(`Sync failed for app`, { tenantId, appId, error: err.message });
    }
    throw err;
  }
}
