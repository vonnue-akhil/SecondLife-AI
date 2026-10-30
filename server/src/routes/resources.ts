import { Router } from 'express';
import { ResourceSearchRequestSchema, ResourcesQuerySchema, type ResourceSearchResponse } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { resourceFinder } from '../providers';
import { detectBrand } from '../services/brand';
import { listResources, regionOf, resourcesForActions } from '../services/resource.service';
import { getSession, saveSession } from '../services/session.store';

const SEARCH_TIMEOUT_MS = 40_000;
const NONE: ResourceSearchResponse = { resources: [], searched: false };

export const resourcesRouter = Router();

resourcesRouter.get('/', (req, res) => {
  const query = ResourcesQuerySchema.safeParse(req.query);
  if (!query.success) throw new AppError('INVALID_INPUT', 400, 'Unknown action. Use repair, reuse, donate, resell, recycle or stop_use.');
  res.json({ resources: listResources(query.data.region, query.data.action) });
});

// Slow (about 10-15 s): the client shows the curated links first and appends these when they arrive.
resourcesRouter.post('/search', async (req, res) => {
  const body = ResourceSearchRequestSchema.safeParse(req.body);
  if (!body.success) throw new AppError('INVALID_INPUT', 400, 'Send a conversationId.');
  const session = getSession(body.data.conversationId);
  if (!session) throw new AppError('NOT_FOUND', 404, 'This conversation has expired.');
  const rec = session.lastRecommendation;
  if (!resourceFinder || !rec) {
    res.json(NONE);
    return;
  }
  if (session.webResources?.for === rec) {
    res.json({ resources: session.webResources.resources, searched: true } satisfies ResourceSearchResponse);
    return;
  }
  try {
    const curated = resourcesForActions(rec.recommendations.map((r) => r.action), regionOf(session), detectBrand(session));
    const resources = await resourceFinder.find(session, curated, AbortSignal.timeout(SEARCH_TIMEOUT_MS));
    session.webResources = { for: rec, resources };
    saveSession(session);
    res.json({ resources, searched: true } satisfies ResourceSearchResponse);
  } catch (err) {
    console.error('[finder] failed:', err instanceof Error ? err.message : err);
    res.json(NONE);
  }
});
