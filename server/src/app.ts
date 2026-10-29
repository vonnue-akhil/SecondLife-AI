import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { CLIENT_DIST_DIR } from './config';
import { apiNotFound, errorHandler } from './middleware/errors';
import { chatRouter } from './routes/chat';
import { healthRouter } from './routes/health';
import { outcomesRouter } from './routes/outcomes';
import { resourcesRouter } from './routes/resources';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '32kb' }));

  app.use('/api/v1/health', healthRouter);
  app.use('/api/v1/chat', chatRouter);
  app.use('/api/v1/resources', resourcesRouter);
  app.use('/api/v1/outcomes', outcomesRouter);
  app.use('/api', apiNotFound);

  // Production: serve the built client, with an SPA fallback for non-API paths.
  if (fs.existsSync(path.join(CLIENT_DIST_DIR, 'index.html'))) {
    app.use(express.static(CLIENT_DIST_DIR, { index: false, maxAge: '1h' }));
    app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html')));
  }

  app.use(errorHandler);
  return app;
}
