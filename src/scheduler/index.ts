import cron from 'node-cron';
import { logger } from '../utils/logger';
import * as tenantService from '../services/tenant.service';
import * as appService from '../services/app.service';
import * as ticketSyncService from '../services/ticketSync.service';

export function startScheduler(): void {
  // Sync tickets every 5 minutes for all active tenants
  cron.schedule('*/5 * * * *', async () => {
    logger.info('Starting scheduled ticket sync');
    try {
      const tenants = await tenantService.getActiveTenants();

      for (const tenant of tenants) {
        const inputApps = await appService.getActiveInputApps(tenant.id);

        for (const app of inputApps) {
          try {
            await ticketSyncService.syncInputApp(tenant as any, app as any);
            logger.info(`Synced app ${app.code} (id: ${app.id}) for tenant ${tenant.slug}`);
          } catch (err) {
            logger.error(`Sync failed for tenant ${tenant.slug}, app ${app.code} (id: ${app.id})`, err);
          }
        }
      }
    } catch (err) {
      logger.error('Scheduled sync failed', err);
    }
  });

  // Backfill missing embeddings daily at 2 AM
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting embedding backfill');
    try {
      await ticketSyncService.backfillMissingEmbeddings();
      logger.info('Embedding backfill completed');
    } catch (err) {
      logger.error('Embedding backfill failed', err);
    }
  });

  logger.info('Scheduler started');
}
