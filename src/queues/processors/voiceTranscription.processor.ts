import { Job } from 'bullmq';
import { getQueue, QUEUE_NAMES } from '../queues';
import * as tenantService from '../../services/tenant.service';
import * as voiceRepo from '../../repositories/voiceRecording.repository';
import * as voiceTranscription from '../../services/voiceTranscription.service';
import { logger } from '../../utils/logger';

const PER_TENANT_BATCH = 50;

export async function scanVoiceTranscription(_job: Job): Promise<number> {
  const queue = getQueue(QUEUE_NAMES.TRANSCRIBE_RECORDING);
  const tenants = await tenantService.getActiveTenants();
  let enqueued = 0;

  for (const tenant of tenants) {
    const pending = await voiceRepo.findPendingVoiceRecordings(tenant.id, PER_TENANT_BATCH);
    for (const rec of pending) {
      await queue.add(
        'transcribe-recording',
        { tenantId: tenant.id, recordingId: rec.id },
        {
          jobId: `transcribe-recording-${rec.id}`,
          removeOnComplete: 200,
          removeOnFail: 500,
        },
      );
      enqueued++;
    }
  }

  return enqueued;
}

export async function processTranscribeRecording(job: Job): Promise<void> {
  const { tenantId, recordingId } = job.data;

  try {
    await voiceTranscription.transcribeRecording(tenantId, recordingId);
  } catch (err) {
    logger.error('Transcription job failed', {
      tenantId,
      recordingId,
      error: (err as Error).message,
    });
    throw err;
  }
}
