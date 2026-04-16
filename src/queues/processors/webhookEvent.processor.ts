import { Job } from 'bullmq';
import * as tenantService from '../../services/tenant.service';
import * as appService from '../../services/app.service';
import { createWebhookHandler } from '../../apps/app.factory';
import { WebhookEvent } from '../../apps/app.interface';
import { logger } from '../../utils/logger';

export async function processWebhookEvent(job: Job): Promise<void> {
  const { tenantId, appId, appCode, event } = job.data as {
    tenantId: string;
    appId: string;
    appCode: string;
    event: WebhookEvent;
  };

  const tenant = await tenantService.getTenantById(tenantId);
  if (!tenant) {
    logger.warn('Webhook event skipped: tenant not found', { tenantId });
    return;
  }

  const app = await appService.getApp(tenantId, appId);
  if (!app) {
    logger.warn('Webhook event skipped: app not found', { tenantId, appId });
    return;
  }

  const handleEvent = createWebhookHandler(app as any);
  await handleEvent(tenant as any, app as any, event);
}
