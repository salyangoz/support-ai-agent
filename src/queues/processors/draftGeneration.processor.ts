import { Job } from 'bullmq';
import { processDraftGenerationJob } from '../../services/draftGeneration.service';

export async function processDraftGeneration(job: Job): Promise<void> {
  const { tenantId, ticketId } = job.data as { tenantId: string; ticketId: string };
  await processDraftGenerationJob({ tenantId, ticketId });
}
