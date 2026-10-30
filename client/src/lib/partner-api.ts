// Partner programme calls: registration, partner tools and the demo listing. Light shape checks only.
import type {
  Partner,
  PartnerRegistration,
  PartnerRegistrationResponse,
  PartnerService,
  Reward,
} from '../../../shared/schemas';
import { ApiError, request } from './api';

const TIMEOUT_MS = 10_000;

export interface PartnerCredentials {
  partnerId: string;
  pin: string;
}
export interface PartnerSession {
  partner: Partner;
  status: 'approved' | 'pending';
}
export interface HandoverResult {
  action: PartnerService;
  points: number;
  device: string;
}
export interface DemoPartners {
  pin: string;
  partners: { id: string; name: string; state: string; district: string | null }[];
}

const bad = () => new ApiError('BAD_RESPONSE', 'We got a reply we couldn’t read. Please try again.', null);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function post(path: string, body: unknown, signal?: AbortSignal) {
  return request(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }, TIMEOUT_MS, signal);
}

function checkReward(raw: unknown): Reward {
  if (!isObj(raw) || typeof raw.title !== 'string' || typeof raw.points !== 'number') throw bad();
  return raw as unknown as Reward;
}

export async function registerPartner(body: PartnerRegistration, signal?: AbortSignal): Promise<PartnerRegistrationResponse> {
  const r = await post('/partners', body, signal);
  if (!isObj(r) || typeof r.id !== 'string' || typeof r.pin !== 'string') throw bad();
  return { id: r.id, pin: r.pin, status: 'pending' };
}

export async function partnerLogin(auth: PartnerCredentials, signal?: AbortSignal): Promise<PartnerSession> {
  const r = await post('/partner/login', auth, signal);
  if (!isObj(r) || !isObj(r.partner) || typeof r.partner.name !== 'string') throw bad();
  if (r.status !== 'approved' && r.status !== 'pending') throw bad();
  return { partner: r.partner as unknown as Partner, status: r.status };
}

export async function confirmHandover(auth: PartnerCredentials, code: string, signal?: AbortSignal): Promise<HandoverResult> {
  const r = await post('/partner/handovers/confirm', { ...auth, code }, signal);
  if (!isObj(r) || typeof r.action !== 'string' || typeof r.points !== 'number' || typeof r.device !== 'string') throw bad();
  return { action: r.action as PartnerService, points: r.points, device: r.device };
}

export async function useRedemption(auth: PartnerCredentials, code: string, signal?: AbortSignal): Promise<Reward> {
  const r = await post('/partner/redemptions/use', { ...auth, code }, signal);
  return checkReward(isObj(r) ? r.reward : null);
}

export async function offerReward(
  auth: PartnerCredentials,
  reward: { title: string; description: string; points: number },
  signal?: AbortSignal,
): Promise<Reward> {
  return checkReward(await post('/partner/rewards', { ...auth, ...reward }, signal));
}

/** The demo listing, or null when the demo is off or unreachable. */
export async function getDemoPartners(signal?: AbortSignal): Promise<DemoPartners | null> {
  try {
    const r = await request('/partner/demo', { method: 'GET' }, TIMEOUT_MS, signal);
    if (!isObj(r) || typeof r.pin !== 'string' || !Array.isArray(r.partners)) return null;
    return r as unknown as DemoPartners;
  } catch {
    return null;
  }
}

/** "sl 7k4q9x", "SL7K4Q9X" and "7k4q9x" all become "SL-7K4Q9X"; other prefixes (RW-) are kept. */
export function normaliseCode(raw: string, prefix: 'SL' | 'RW'): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!s) return '';
  const body = s.startsWith(prefix) && s.length > prefix.length ? s.slice(prefix.length) : s;
  return `${prefix}-${body}`;
}
