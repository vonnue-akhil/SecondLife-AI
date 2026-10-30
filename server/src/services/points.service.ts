// Wallets, handover codes and reward redemptions. Points are credited only when a partner confirms a handover.
import {
  HANDOVER_POINTS,
  type ConfirmHandoverResponseSchema,
  type Handover,
  type HandoverRequest,
  type Partner,
  type Redemption,
  type Wallet,
} from '../../../shared/schemas';
import type { z } from 'zod';
import { AppError } from '../middleware/errors';
import { findReward, getApprovedPartner } from './partners.service';
import { randomCode } from './pin';
import { getSession } from './session.store';
import { data, persist, type StoredHandover, type StoredWallet } from './store';

const HANDOVER_TTL_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_OPEN_HANDOVERS = 5;
const MAX_HISTORY = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Reads the X-Wallet-Id header; it must be a UUID. */
export function walletIdFrom(header: string | undefined): string {
  if (!header || !UUID.test(header)) throw new AppError('UNAUTHORIZED', 401, 'Missing or invalid wallet id.');
  return header.toLowerCase();
}

const emptyWallet = (): StoredWallet => ({ points: 0, demoPoints: 0, history: [] });

function toWallet(w: StoredWallet | undefined): Wallet {
  const { points, demoPoints, history } = w ?? emptyWallet();
  return { points, demoPoints, history: history.slice(0, MAX_HISTORY) };
}

export const getWallet = (walletId: string): Wallet => toWallet(data.wallets[walletId]);

function walletFor(walletId: string): StoredWallet {
  return (data.wallets[walletId] ??= emptyWallet());
}

function record(w: StoredWallet, kind: 'earned' | 'redeemed', points: number, label: string, demo: boolean) {
  w.history.unshift({ kind, points, label, demo, at: new Date().toISOString() });
  w.history.length = Math.min(w.history.length, MAX_HISTORY);
}

function toHandover({ walletId: _w, device: _d, conversationId: _c, ...h }: StoredHandover): Handover {
  return h;
}

function expireIfDue(h: StoredHandover): void {
  if (h.status === 'open' && Date.parse(h.expiresAt) < Date.now()) {
    h.status = 'expired';
    persist();
  }
}

export function createHandover(walletId: string, req: HandoverRequest): Handover {
  const partner = getApprovedPartner(req.partnerId);
  if (!partner) throw new AppError('NOT_FOUND', 404, 'That partner is not available.');
  if (!partner.services.includes(req.action)) throw new AppError('INVALID_INPUT', 400, `${partner.name} does not offer that service.`);

  const open = Object.values(data.handovers).filter((h) => {
    expireIfDue(h);
    return h.walletId === walletId && h.status === 'open';
  });
  // Asking again for the same handover returns the code already issued rather than spending a slot.
  const same = open.find((h) => h.partnerId === partner.id && h.action === req.action && h.conversationId === req.conversationId);
  if (same) return toHandover(same);
  if (open.length >= MAX_OPEN_HANDOVERS) throw new AppError('CONFLICT', 409, 'You already have 5 open handover codes. Use or wait for them to expire first.');

  const type = req.conversationId ? getSession(req.conversationId)?.observations?.deviceType : undefined;
  let code = `SL-${randomCode(6)}`;
  while (data.handovers[code]) code = `SL-${randomCode(6)}`;
  const h: StoredHandover = {
    code,
    walletId,
    action: req.action,
    partnerId: partner.id,
    partnerName: partner.name,
    points: HANDOVER_POINTS[req.action],
    demo: partner.demo,
    device: type && type !== 'unknown' ? type : 'a device',
    conversationId: req.conversationId,
    status: 'open',
    expiresAt: new Date(Date.now() + HANDOVER_TTL_MS).toISOString(),
  };
  data.handovers[code] = h;
  persist();
  return toHandover(h);
}

export function getHandover(walletId: string, code: string): Handover {
  const h = data.handovers[code.toUpperCase()];
  if (!h || h.walletId !== walletId) throw new AppError('NOT_FOUND', 404, 'No such handover code.');
  expireIfDue(h);
  return toHandover(h);
}

const VERB = { donate: 'Donated', recycle: 'Recycled', repair: 'Repaired' } as const;

export function confirmHandover(partner: Partner, rawCode: string): z.infer<typeof ConfirmHandoverResponseSchema> {
  const h = data.handovers[rawCode.toUpperCase()];
  if (!h || h.partnerId !== partner.id) throw new AppError('NOT_FOUND', 404, 'That code does not belong to this partner.');
  expireIfDue(h);
  if (h.status !== 'open') throw new AppError('CONFLICT', 409, h.status === 'expired' ? 'That code has expired.' : 'That code was already confirmed.');
  h.status = 'confirmed';
  const w = walletFor(h.walletId);
  if (h.demo) w.demoPoints += h.points;
  else w.points += h.points;
  const device = h.device === 'a device' ? 'a device' : `a ${h.device}`;
  record(w, 'earned', h.points, `${VERB[h.action]} ${device} at ${h.partnerName}`, h.demo);
  persist();
  console.log(`[points] +${h.points} ${h.action} demo=${h.demo}`);
  return { action: h.action, points: h.points, device: h.device };
}

export function redeem(walletId: string, rewardId: string): Redemption {
  const reward = findReward(rewardId);
  if (!reward) throw new AppError('NOT_FOUND', 404, 'That reward is not available.');
  const w = walletFor(walletId);
  const have = reward.demo ? w.demoPoints : w.points;
  if (have < reward.points) {
    const kind = reward.demo ? 'demo points' : 'points';
    throw new AppError('CONFLICT', 409, `You need ${reward.points - have} more ${kind}.`);
  }
  if (reward.demo) w.demoPoints -= reward.points;
  else w.points -= reward.points;
  record(w, 'redeemed', -reward.points, `Redeemed ${reward.title} at ${reward.partnerName}`, reward.demo);
  let code = `RW-${randomCode(6)}`;
  while (data.redemptions[code]) code = `RW-${randomCode(6)}`;
  data.redemptions[code] = { code, walletId, reward, used: false, at: new Date().toISOString() };
  persist();
  console.log(`[points] -${reward.points} redeem demo=${reward.demo}`);
  return { code, reward, wallet: toWallet(w) };
}

export function useRedemption(partner: Partner, rawCode: string) {
  const r = data.redemptions[rawCode.toUpperCase()];
  if (!r || r.reward.partnerId !== partner.id) throw new AppError('NOT_FOUND', 404, 'That code is not for one of your rewards.');
  if (r.used) throw new AppError('CONFLICT', 409, 'That code was already used.');
  r.used = true;
  persist();
  return { reward: r.reward };
}
