// Partners (demo seed plus registered), rewards, PIN authentication and admin moderation.
import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  PartnerSchema,
  RewardSchema,
  type Partner,
  type PartnerRegistration,
  type PartnerRegistrationResponse,
  type PartnerService,
  type Reward,
} from '../../../shared/schemas';
import type { StateCode } from '../../../shared/india-states';
import seedJson from '../data/demo-partners.json';
import { env } from '../config';
import { AppError } from '../middleware/errors';
import { assertNotLimited, clearFailures, generatePin, hashPin, recordFailure, safeEqual, verifyPin } from './pin';
import { data, persist, type StoredPartner } from './store';

// Read-only demo seed, validated at startup. Demo rewards carry only an id, partner, title, text and cost.
const SeedSchema = z.object({
  partners: z.array(PartnerSchema.extend({ demo: z.literal(true), phone: z.null() })),
  rewards: z.array(RewardSchema.pick({ id: true, partnerId: true, title: true, description: true, points: true })),
});
const seed = SeedSchema.parse(seedJson);
const demoPartners = new Map<string, Partner>(seed.partners.map((p) => [p.id, p]));
const demoRewards: Reward[] = seed.rewards.map((r) => {
  const p = demoPartners.get(r.partnerId);
  if (!p) throw new Error(`demo reward ${r.id} names unknown partner ${r.partnerId}`);
  return { ...r, partnerName: p.name, state: p.state, district: p.district, demo: true };
});

const publicPartner = ({ status: _s, pinHash: _h, createdAt: _c, ...p }: StoredPartner): Partner => p;

export interface AuthedPartner {
  partner: Partner;
  status: 'approved' | 'pending';
}

export function findPartner(id: string): AuthedPartner | null {
  const demo = demoPartners.get(id);
  if (demo) return { partner: demo, status: 'approved' };
  const stored = data.partners[id];
  return stored ? { partner: publicPartner(stored), status: stored.status } : null;
}

/** Approved partners only. */
export function getApprovedPartner(id: string): Partner | null {
  const found = findPartner(id);
  return found?.status === 'approved' ? found.partner : null;
}

function approvedPartners(): Partner[] {
  return [...demoPartners.values(), ...Object.values(data.partners).filter((p) => p.status === 'approved').map(publicPartner)];
}

const same = (a: string | null, b: string | null) => !!a && !!b && a.toLowerCase() === b.toLowerCase();

export function listPartners(q: { state?: StateCode; district?: string; service?: PartnerService }): Partner[] {
  let list = approvedPartners().filter((p) => !q.service || p.services.includes(q.service));
  if (!q.state) return list.slice(0, 50);
  list = list.filter((p) => p.state === q.state);
  const rank = (p: Partner) => (same(p.district, q.district ?? null) ? 0 : 1);
  return list.sort((a, b) => rank(a) - rank(b)).slice(0, 5);
}

export function listRewards(state?: StateCode): Reward[] {
  const ok = (r: Reward) => demoPartners.has(r.partnerId) || data.partners[r.partnerId]?.status === 'approved';
  const all = [...demoRewards, ...Object.values(data.rewards).filter(ok)];
  return state ? [...all.filter((r) => r.state === state), ...all.filter((r) => r.state !== state)] : all;
}

export function findReward(id: string): Reward | null {
  return demoRewards.find((r) => r.id === id) ?? (data.rewards[id] && listRewards().find((r) => r.id === id)) ?? null;
}

export function registerPartner(reg: PartnerRegistration): PartnerRegistrationResponse {
  const { consent: _consent, ...fields } = reg;
  const id = `p-${randomBytes(5).toString('hex')}`;
  const pin = generatePin();
  data.partners[id] = { id, ...fields, demo: false, status: 'pending', pinHash: hashPin(pin), createdAt: new Date().toISOString() };
  persist();
  console.log(`[partner] registered ${id} (pending)`);
  return { id, pin, status: 'pending' };
}

/** Checks the PIN with rate limiting; returns the partner and whether it is approved. */
export function authenticate(partnerId: string, pin: string): AuthedPartner {
  assertNotLimited(partnerId);
  const found = findPartner(partnerId);
  const stored = data.partners[partnerId];
  let ok = false;
  if (found?.partner.demo) ok = env.DEMO_PARTNER_PIN !== '' && safeEqual(pin, env.DEMO_PARTNER_PIN);
  else if (stored) ok = verifyPin(pin, stored.pinHash);
  if (!found || !ok) {
    recordFailure(partnerId);
    throw new AppError('UNAUTHORIZED', 401, 'That partner ID and PIN do not match.');
  }
  clearFailures(partnerId);
  return found;
}

/** Like authenticate, but the partner must be approved. */
export function authenticateApproved(partnerId: string, pin: string): Partner {
  const auth = authenticate(partnerId, pin);
  if (auth.status !== 'approved') throw new AppError('UNAUTHORIZED', 403, 'Your listing is still waiting for approval, so this is not available yet.');
  return auth.partner;
}

export function offerReward(partner: Partner, input: { title: string; description: string; points: number }): Reward {
  const reward: Reward = {
    id: `rw-${randomUUID().slice(0, 8)}`,
    partnerId: partner.id,
    partnerName: partner.name,
    ...input,
    state: partner.state,
    district: partner.district,
    demo: partner.demo,
  };
  data.rewards[reward.id] = reward;
  persist();
  return reward;
}

export function demoInfo() {
  if (!env.DEMO_PARTNER_PIN) throw new AppError('NOT_FOUND', 404, 'Demo partner tools are not enabled.');
  return { pin: env.DEMO_PARTNER_PIN, partners: [...demoPartners.values()].map(({ id, name, state, district }) => ({ id, name, state, district })) };
}

// Admin moderation

export function pendingPartners(): (Partner & { createdAt: string })[] {
  return Object.values(data.partners).filter((p) => p.status === 'pending').map((p) => ({ ...publicPartner(p), createdAt: p.createdAt }));
}

export function moderate(id: string, decision: 'approve' | 'reject'): void {
  const p = data.partners[id];
  if (!p) throw new AppError('NOT_FOUND', 404, 'No such registered partner.');
  if (decision === 'approve') p.status = 'approved';
  else {
    delete data.partners[id];
    for (const [rid, r] of Object.entries(data.rewards)) if (r.partnerId === id) delete data.rewards[rid];
  }
  persist();
  console.log(`[partner] ${decision} ${id}`);
}
