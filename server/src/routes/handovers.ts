import { Router } from 'express';
import { HandoverRequestSchema } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { createHandover, getHandover, walletIdFrom } from '../services/points.service';

export const handoversRouter = Router();

handoversRouter.post('/', (req, res) => {
  const walletId = walletIdFrom(req.header('x-wallet-id'));
  const body = HandoverRequestSchema.safeParse(req.body);
  if (!body.success) throw new AppError('INVALID_INPUT', 400, 'Send an action (donate, recycle or repair) and a partnerId.');
  res.status(201).json(createHandover(walletId, body.data));
});

handoversRouter.get('/:code', (req, res) => {
  res.json(getHandover(walletIdFrom(req.header('x-wallet-id')), req.params.code));
});
