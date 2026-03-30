import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config';
import { logger } from './utils/logger';
import { createRouter } from './routes';
import { startScheduler } from './scheduler';

export function createApp(): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors());

  app.use('/webhooks', express.raw({ type: 'application/json' }));
  app.use(express.json());

  app.use(createRouter());

  return app;
}

async function main(): Promise<void> {
  try {
    const app = createApp();

    startScheduler();

    app.listen(config.port, () => {
      logger.info(`Server running on port ${config.port}`);
    });
  } catch (err) {
    logger.error('Failed to start server', err);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
