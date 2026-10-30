import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CLIENT_DIST_DIR } from './config';
import { apiNotFound, errorHandler } from './middleware/errors';
import { adminRouter } from './routes/admin';
import { chatRouter } from './routes/chat';
import { handoversRouter } from './routes/handovers';
import { healthRouter } from './routes/health';
import { outcomesRouter } from './routes/outcomes';
import { partnerRouter } from './routes/partner';
import { partnersRouter } from './routes/partners';
import { resourcesRouter } from './routes/resources';
import { rewardsRouter } from './routes/rewards';
import { transcribeRouter } from './routes/transcribe';
import { walletRouter } from './routes/wallet';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/chat', chatRouter);
  app.use('/api/v1/resources', resourcesRouter);
  app.use('/api/v1/outcomes', outcomesRouter);
  app.use('/api/v1/transcribe', transcribeRouter);
  app.use('/api/v1/partners', partnersRouter);
  app.use('/api/v1/rewards', rewardsRouter);
  app.use('/api/v1/wallet', walletRouter);
  app.use('/api/v1/handovers', handoversRouter);
  app.use('/api/v1/partner', partnerRouter);
  app.use('/api/v1/admin', adminRouter);
  app.use('/api', apiNotFound);

  // Production: serve the built client, with an SPA fallback for non-API paths.
  if (fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'))) {
    app.use(express.static(CLIENT_DIST_DIR, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
