import { Router } from 'express';
import { RewardsQuerySchema, type RewardsResponse } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { listRewards } from '../services/partners.service';
import { redeem, walletIdFrom } from '../services/points.service';

export const rewardsRouter = Router();

rewardsRouter.get('/', (req, res) => {
  const q = RewardsQuerySchema.safeParse(req.query);
  if (!q.success) throw new AppError('INVALID_INPUT', 400, 'Use a valid state code.');
  const body: RewardsResponse = { rewards: listRewards(q.data.state) };
  res.json(body);
});

rewardsRouter.post('/:id/redeem', (req, res) => {
  res.json(redeem(walletIdFrom(req.header('x-wallet-id')), req.params.id));
});
