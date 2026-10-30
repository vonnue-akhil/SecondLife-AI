import { Router } from 'express';
import { OutcomeRequestSchema } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { getSession, saveSession } from '../services/session.store';

export const outcomesRouter = Router();

outcomesRouter.post('/', (req, res) => {
  const body = OutcomeRequestSchema.safeParse(req.body);
  if (!body.success) throw new AppError('INVALID_INPUT', 400, 'Send a conversationId and an outcome (repaired, reused, donated, sold, recycled or undecided).');
  const session = getSession(body.data.conversationId);
  if (!session) throw new AppError('NOT_FOUND', 404, 'This conversation has expired. Start a new one to record a decision.');
  session.outcome = body.data.outcome;
  saveSession(session);
  console.log(`[outcome] ${session.id} ${body.data.outcome}`);
  res.json({ ok: true });
});
