import * as Sentry from '@sentry/node';
import { config } from '../config';

export function initSentry(): void {
  if (!config.sentryDsn) return;

  Sentry.init({
    dsn: config.sentryDsn,
    environment: config.nodeEnv,
    tracesSampleRate: config.nodeEnv === 'production' ? 0.1 : 1.0,
  });
}

export { Sentry };
