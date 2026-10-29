import { Router } from 'express';
import { ResourcesQuerySchema } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { listResources } from '../services/resource.service';

export const resourcesRouter = Router();

resourcesRouter.get('/', (req, res) => {
  const query = ResourcesQuerySchema.safeParse(req.query);
  if (!query.success) throw new AppError('INVALID_INPUT', 400, 'Unknown action. Use repair, reuse, donate, resell, recycle or stop_use.');
  res.json({ resources: listResources(query.data.region, query.data.action) });
});
