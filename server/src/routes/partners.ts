import { Router } from 'express';
import { PartnerRegistrationSchema, PartnersQuerySchema, type PartnersResponse } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { listPartners, registerPartner } from '../services/partners.service';

export const partnersRouter = Router();

partnersRouter.get('/', (req, res) => {
  const q = PartnersQuerySchema.safeParse(req.query);
  if (!q.success) throw new AppError('INVALID_INPUT', 400, 'Use a valid state code, district and service (repair, donate or recycle).');
  const body: PartnersResponse = { partners: listPartners(q.data) };
  res.json(body);
});

partnersRouter.post('/', (req, res) => {
  const body = PartnerRegistrationSchema.safeParse(req.body);
  if (!body.success) throw new AppError('INVALID_INPUT', 400, 'Please fill in every field, use a valid phone number and agree to be listed.');
  res.status(201).json(registerPartner(body.data));
});
