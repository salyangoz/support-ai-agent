import { Job } from 'bullmq';
import * as tenantService from '../../services/tenant.service';
import { generateKbFromTicket } from '../../services/ticketKb.service';
import { Tenant } from '../../models/types';
import { logger } from '../../utils/logger';

export async function processGenerateKbFromTicket(job: Job): Promise<void> {
  const { tenantId, ticketId } = job.data;

  const tenant = await tenantService.getTenantById(tenantId);
  if (!tenant) return;

  const article = await generateKbFromTicket(tenant as Tenant, ticketId);

  if (article) {
    logger.info('KB article generated from ticket', { tenantId, ticketId, articleId: article.id });
  }
}
