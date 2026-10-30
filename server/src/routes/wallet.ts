import { Router } from 'express';
import { getWallet, walletIdFrom } from '../services/points.service';

export const walletRouter = Router();

walletRouter.get('/', (req, res) => {
  res.json(getWallet(walletIdFrom(req.header('x-wallet-id'))));
});
