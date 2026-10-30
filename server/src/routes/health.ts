import { Router } from 'express';
import type { HealthResponse } from '../../../shared/schemas';
import { assessmentProvider, resourceFinder, speechToText } from '../providers';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  const body: HealthResponse = {
    ok: true,
    provider: assessmentProvider.name,
    isMock: assessmentProvider.isMock,
    supportsImages: assessmentProvider.supportsImages,
    supportsVideo: assessmentProvider.supportsVideo,
    speechToText: speechToText !== null,
    webSearch: resourceFinder !== null,
  };
  res.json(body);
});
