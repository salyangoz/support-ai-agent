import { Request, Response, NextFunction } from 'express';
import { Sentry } from '../utils/sentry';
import { logger } from '../utils/logger';
import { config } from '../config';

export function errorHandler(
  err: Error & { statusCode?: number },
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const statusCode = err.statusCode || 500;

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    method: req.method,
    path: req.path,
    statusCode,
  });

  if (statusCode >= 500) {
    Sentry.captureException(err);
  }

  const response: { error: string; stack?: string } = {
    error: err.message || 'Internal Server Error',
  };

  if (config.nodeEnv === 'development' && err.stack) {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
}
