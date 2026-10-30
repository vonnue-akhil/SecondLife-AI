// Moderation of partner registrations. Exists only when ADMIN_TOKEN is set.
import { Router, type RequestHandler } from 'express';
import { env } from '../config';
import { AppError } from '../middleware/errors';
import { moderate, pendingPartners } from '../services/partners.service';
import { safeEqual } from '../services/pin';

export const adminRouter = Router();

const guard: RequestHandler = (req, _res, next) => {
  if (!env.ADMIN_TOKEN) throw new AppError('NOT_FOUND', 404, 'That API route does not exist.');
  const token = /^Bearer (.+)$/.exec(req.header('authorization') ?? '')?.[1];
  if (!token || !safeEqual(token, env.ADMIN_TOKEN)) throw new AppError('UNAUTHORIZED', 401, 'Invalid admin token.');
  next();
};
adminRouter.use(guard);

adminRouter.get('/partners', (req, res) => {
  const pending = pendingPartners();
  res.json({ partners: req.query.status === 'pending' || !req.query.status ? pending : [] });
});

adminRouter.post('/partners/:id/approve', (req, res) => {
  moderate(req.params.id, 'approve');
  res.json({ ok: true });
});

adminRouter.post('/partners/:id/reject', (req, res) => {
  moderate(req.params.id, 'reject');
  res.json({ ok: true });
});
