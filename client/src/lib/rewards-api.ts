// Partners, wallet, handovers and rewards: typed calls with light shape checks.
import type {
  Handover,
  Partner,
  PartnerService,
  Redemption,
  Reward,
  Wallet,
} from '../../../shared/schemas';
import type { StateCode } from '../../../shared/india-states';
import { ApiError, request } from './api';
import { getWalletId } from './wallet-id';

const TIMEOUT_MS = 10_000;

function bad(): ApiError {
  return new ApiError('BAD_RESPONSE', 'We got a reply we couldn’t read. Please try again.', null);
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' ? v : fallback);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);

function partner(raw: unknown): Partner {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.name !== 'string') throw bad();
  const demo = raw.demo === true;
  return {
    id: raw.id,
    name: raw.name,
    services: Array.isArray(raw.services) ? (raw.services as PartnerService[]) : [],
    devices: Array.isArray(raw.devices) ? raw.devices.filter((d): d is string => typeof d === 'string') : [],
    state: raw.state as StateCode,
    district: strOrNull(raw.district),
    place: strOrNull(raw.place),
    phone: demo ? null : strOrNull(raw.phone), // a demo listing never shows contact details
    whatsapp: !demo && raw.whatsapp === true,
    demo,
  };
}

function reward(raw: unknown): Reward {
  if (!isObj(raw) || typeof raw.id !== 'string' || typeof raw.title !== 'string') throw bad();
  return {
    id: raw.id,
    partnerId: str(raw.partnerId),
    partnerName: str(raw.partnerName),
    title: raw.title,
    description: str(raw.description),
    points: num(raw.points),
    state: raw.state as StateCode,
    district: strOrNull(raw.district),
    demo: raw.demo === true,
  };
}

function wallet(raw: unknown): Wallet {
  if (!isObj(raw)) throw bad();
  const history = Array.isArray(raw.history) ? raw.history : [];
  return {
    points: num(raw.points),
    demoPoints: num(raw.demoPoints),
    history: history.filter(isObj).map((e) => ({
      kind: e.kind === 'redeemed' ? 'redeemed' : 'earned',
      points: num(e.points),
      label: str(e.label),
      demo: e.demo === true,
      at: str(e.at),
    })),
  };
}

function handover(raw: unknown): Handover {
  if (!isObj(raw) || typeof raw.code !== 'string') throw bad();
  const status = raw.status === 'confirmed' || raw.status === 'expired' ? raw.status : 'open';
  return {
    code: raw.code,
    action: raw.action as PartnerService,
    partnerId: str(raw.partnerId),
    partnerName: str(raw.partnerName),
    points: num(raw.points),
    demo: raw.demo === true,
    status,
    expiresAt: str(raw.expiresAt),
  };
}

const walletHeaders = (json = false): Record<string, string> => ({
  'X-Wallet-Id': getWalletId(),
  ...(json ? { 'Content-Type': 'application/json' } : {}),
});

export async function getPartners(
  query: { state: StateCode; district?: string | null; service: PartnerService },
  signal?: AbortSignal,
): Promise<Partner[]> {
  const params = new URLSearchParams({ state: query.state, service: query.service });
  if (query.district) params.set('district', query.district);
  const body = await request(`/partners?${params}`, { method: 'GET' }, TIMEOUT_MS, signal);
  if (!isObj(body) || !Array.isArray(body.partners)) throw bad();
  return body.partners.map(partner);
}

export async function getRewards(state: StateCode | null, signal?: AbortSignal): Promise<Reward[]> {
  const body = await request(`/rewards${state ? `?state=${state}` : ''}`, { method: 'GET' }, TIMEOUT_MS, signal);
  if (!isObj(body) || !Array.isArray(body.rewards)) throw bad();
  return body.rewards.map(reward);
}

export async function getWallet(signal?: AbortSignal): Promise<Wallet> {
  return wallet(await request('/wallet', { method: 'GET', headers: walletHeaders() }, TIMEOUT_MS, signal));
}

export async function createHandover(
  payload: { action: PartnerService; partnerId: string; conversationId?: string | null },
  signal?: AbortSignal,
): Promise<Handover> {
  const body = JSON.stringify({
    action: payload.action,
    partnerId: payload.partnerId,
    ...(payload.conversationId ? { conversationId: payload.conversationId } : {}),
  });
  return handover(await request('/handovers', { method: 'POST', headers: walletHeaders(true), body }, TIMEOUT_MS, signal));
}

export async function getHandover(code: string, signal?: AbortSignal): Promise<Handover> {
  const path = `/handovers/${encodeURIComponent(code)}`;
  return handover(await request(path, { method: 'GET', headers: walletHeaders() }, TIMEOUT_MS, signal));
}

export async function redeemReward(id: string, signal?: AbortSignal): Promise<Redemption> {
  const body = await request(`/rewards/${encodeURIComponent(id)}/redeem`, { method: 'POST', headers: walletHeaders() }, TIMEOUT_MS, signal);
  if (!isObj(body) || typeof body.code !== 'string') throw bad();
  return { code: body.code, reward: reward(body.reward), wallet: wallet(body.wallet) };
}
