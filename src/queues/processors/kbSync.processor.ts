import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from '../queues';
import * as tenantService from '../../services/tenant.service';
import * as appService from '../../services/app.service';
import * as appRepo from '../../repositories/app.repository';
import * as knowledgeBaseService from '../../services/knowledgeBase.service';
import { createKnowledgeSourceApp } from '../../apps/app.factory';
import { logger } from '../../utils/logger';

function isAuthError(err: any): boolean {
  const status = err?.response?.status || err?.status;
  return status === 401 || status === 403;
}

/**
 * Scanner: finds all active KB source apps and enqueues a sync job for each.
 */
export async function scanKbSync(job: Job): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.SYNC_KB_APP);
  const tenants = await tenantService.getActiveTenants();
  let enqueued = 0;

  for (const tenant of tenants) {
    const apps = await appService.getApps(tenant.id, { type: 'knowledge', isActive: true });

    for (const app of apps) {
      if (app.role === 'destination') continue;

      await queue.add('sync-kb-app', {
        tenantId: tenant.id,
        appId: app.id,
      }, {
        jobId: `sync-kb-${tenant.id}-${app.id}`,
        removeOnComplete: 100,
        removeOnFail: 200,
      });
      enqueued++;
    }
  }

  return enqueued;
}

/**
 * Worker: syncs one KB source app. Reports health status.
 */
export async function processSyncKbApp(job: Job): Promise<number> {
  const { tenantId, appId } = job.data;

  const tenant = await tenantService.getTenantById(tenantId);
  if (!tenant) return 0;

  const app = await appService.getApp(tenantId, appId);
  if (!app) return 0;

  try {
    const adapter = createKnowledgeSourceApp(app as any, tenant.settings as Record<string, any>);
    const articles = await adapter.fetchArticles();
    let synced = 0;

    for (const article of articles) {
      try {
        await knowledgeBaseService.upsertArticleByExternalId(tenantId, article.externalId, {
          title: article.title,
          content: article.content,
          category: article.category,
          language: article.language,
        });
        synced++;
      } catch (err) {
        logger.error('Failed to sync KB article', {
          tenantId,
          externalId: article.externalId,
          error: (err as Error).message,
        });
      }
    }

    await appRepo.markAppSynced(appId);
    return synced;
  } catch (err: any) {
    if (isAuthError(err)) {
      await appRepo.markAppAuthFailed(appId, 'Authentication failed');
      logger.error('KB app deactivated due to auth failure', { tenantId, appId, error: err.message });
    } else {
      await appRepo.markAppError(appId, err.message);
      logger.error('KB sync failed for app', { tenantId, appId, error: err.message });
    }
    throw err;
  }
}
