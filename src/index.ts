import { initSentry, Sentry } from './utils/sentry';
initSentry();

import express from 'express';
import path from 'path';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { createRouter } from './routes';
import { createQueueDashboard } from './queues/dashboard';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());

  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json());

  // Bull Board dashboard at /queues (protected by helmet, add auth in production)
  const dashboard = createQueueDashboard();
  app.use('/queues', dashboard.getRouter());

  app.use(createRouter());

  Sentry.setupExpressErrorHandler(app);

  return app;
}

async function main(): Promise<void> {
  try {
    const app = createApp();

    app.listen(config.port, () => {
      logger.info(`API server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to start API server', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
