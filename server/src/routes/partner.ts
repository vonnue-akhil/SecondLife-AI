// Partner tools. The PIN travels in the body, never the URL.
import { Router } from 'express';
import {
  ConfirmHandoverSchema,
  OfferRewardSchema,
  PartnerAuthSchema,
  UseRedemptionSchema,
  type PartnerLoginResponseSchema,
  type UseRedemptionResponseSchema,
} from '../../../shared/schemas';
import type { z } from 'zod';
import { AppError } from '../middleware/errors';
import { authenticate, authenticateApproved, demoInfo, offerReward } from '../services/partners.service';
import { confirmHandover, useRedemption } from '../services/points.service';

export const partnerRouter = Router();

function bad(): never {
  throw new AppError('INVALID_INPUT', 400, 'Please check the details you entered.');
}

partnerRouter.get('/demo', (_req, res) => {
  res.json(demoInfo());
});

partnerRouter.post('/login', (req, res) => {
  const b = PartnerAuthSchema.safeParse(req.body);
  if (!b.success) bad();
  const { partner, status } = authenticate(b.data.partnerId, b.data.pin);
  const out: z.infer<typeof PartnerLoginResponseSchema> = { partner, status };
  res.json(out);
});

partnerRouter.post('/handovers/confirm', (req, res) => {
  const b = ConfirmHandoverSchema.safeParse(req.body);
  if (!b.success) bad();
  res.json(confirmHandover(authenticateApproved(b.data.partnerId, b.data.pin), b.data.code));
});

partnerRouter.post('/redemptions/use', (req, res) => {
  const b = UseRedemptionSchema.safeParse(req.body);
  if (!b.success) bad();
  const out: z.infer<typeof UseRedemptionResponseSchema> = useRedemption(authenticateApproved(b.data.partnerId, b.data.pin), b.data.code);
  res.json(out);
});

partnerRouter.post('/rewards', (req, res) => {
  const b = OfferRewardSchema.safeParse(req.body);
  if (!b.success) bad();
  const partner = authenticateApproved(b.data.partnerId, b.data.pin);
  res.status(201).json(offerReward(partner, { title: b.data.title, description: b.data.description, points: b.data.points }));
});
