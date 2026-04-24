import { Request, Response, NextFunction } from 'express';
import * as voiceRepo from '../repositories/voiceRecording.repository';
import { getQueue, QUEUE_NAMES } from '../queues/queues';
import { toSnakeCase } from '../utils/serializer';
import { parsePaginationQuery } from '../utils/pagination';
import { TranscriptionStatus } from '../models/types';

const VALID_STATUSES: TranscriptionStatus[] = ['pending', 'transcribing', 'done', 'failed'];

export async function list(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const statusParam = req.query.status as string | undefined;
    const pagination = parsePaginationQuery(req.query as Record<string, unknown>);

    const status =
      statusParam && VALID_STATUSES.includes(statusParam as TranscriptionStatus)
        ? (statusParam as TranscriptionStatus)
        : undefined;

    const result = await voiceRepo.listVoiceRecordings(tenantId, {
      status,
      cursor: pagination.cursor,
      limit: pagination.limit,
    });

    res.status(200).json(toSnakeCase(result));
  } catch (err) {
    next(err);
  }
}

export async function show(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;
    const recording = await voiceRepo.findVoiceRecordingById(tenantId, id);
    if (!recording) {
      res.status(404).json({ error: 'Voice recording not found' });
      return;
    }
    res.status(200).json(toSnakeCase(recording));
  } catch (err) {
    next(err);
  }
}

export async function retry(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const tenantId = req.params.tenantId as string;
    const id = req.params.id as string;

    const updated = await voiceRepo.resetForRetry(tenantId, id);
    if (!updated) {
      res.status(404).json({ error: 'Voice recording not found' });
      return;
    }

    await getQueue(QUEUE_NAMES.TRANSCRIBE_RECORDING).add(
      'transcribe-recording',
      { tenantId, recordingId: id },
      {
        jobId: `transcribe-recording-${id}`,
        removeOnComplete: 200,
        removeOnFail: 500,
      },
    );

    res.status(200).json(toSnakeCase(updated));
  } catch (err) {
    next(err);
  }
}
