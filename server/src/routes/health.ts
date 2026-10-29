import { Router } from 'express';
import type { HealthResponse } from '../../../shared/schemas';
import { assessmentProvider } from '../providers';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    provider: assessmentProvider.name,
    isMock: assessmentProvider.isMock,
    supportsImages: assessmentProvider.supportsImages,
  };
  res.json(body);
});
