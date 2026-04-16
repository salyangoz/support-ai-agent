import * as appRepo from '../repositories/app.repository';
import { App, TenantSettings } from '../models/types';
import { logger } from '../utils/logger';

/**
 * Resolves which output app(s) should receive a ticket's reply.
 * Supports fan-out: returns an array of apps for parallel delivery.
 *
 * Resolution order:
 * 1. ticket.outputAppId is set -> single app override
 * 2. tenant.settings.output_app_ids is set -> fan-out to all listed active apps
 * 3. ticket.inputAppId is set and that app has role='both' -> fallback to input app
 * 4. No output configured -> throw error
 */
export async function resolveOutputApps(
  tenantId: string,
  ticket: { inputAppId?: string | null; outputAppId?: string | null },
  tenantSettings?: TenantSettings,
): Promise<App[]> {
  // 1. Explicit per-ticket override (single app)
  if (ticket.outputAppId) {
    const app = await appRepo.findAppById(tenantId, ticket.outputAppId);
    if (app && app.isActive && app.role !== 'source') {
      return [app as App];
    }
    logger.warn('Ticket output app override is invalid or inactive', {
      tenantId,
      outputAppId: ticket.outputAppId,
    });
  }

  // 2. Tenant-level fan-out pipeline
  if (tenantSettings?.output_app_ids && tenantSettings.output_app_ids.length > 0) {
    const apps: App[] = [];
    for (const appId of tenantSettings.output_app_ids) {
      const app = await appRepo.findAppById(tenantId, appId);
      if (app && app.isActive && app.role !== 'source') {
        apps.push(app as App);
      }
    }
    if (apps.length > 0) {
      return apps;
    }
    logger.warn('Tenant output pipeline has no active destination apps', {
      tenantId,
      output_app_ids: tenantSettings.output_app_ids,
    });
  }

  // 3. Fallback: input app with role='both'
  if (ticket.inputAppId) {
    const app = await appRepo.findAppById(tenantId, ticket.inputAppId);
    if (app && app.isActive && app.role === 'both') {
      return [app as App];
    }
  }

  // 4. No output configured
  throw new Error(`No output app configured for tenant ${tenantId}`);
}
