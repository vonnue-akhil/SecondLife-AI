// Open handover codes kept per wallet, so a reload of the same conversation still shows the code.
import type { Handover, PartnerService } from '../../../shared/schemas';
import { getWalletId } from './wallet-id';

type Saved = Record<string, Handover>;

const storageKey = () => `secondlife.handovers.${getWalletId()}`;
const slot = (conversationId: string | null, action: PartnerService) => `${conversationId ?? 'none'}:${action}`;

function read(): Saved {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(storageKey()) ?? '{}');
    return raw && typeof raw === 'object' ? (raw as Saved) : {};
  } catch {
    return {};
  }
}

function write(all: Saved) {
  try {
    localStorage.setItem(storageKey(), JSON.stringify(all));
  } catch {
    // Storage blocked: the code is still on screen for this visit.
  }
}

export function loadHandover(conversationId: string | null, action: PartnerService): Handover | null {
  const h = read()[slot(conversationId, action)];
  if (!h || typeof h.code !== 'string' || h.status !== 'open') return null;
  const exp = Date.parse(h.expiresAt);
  return Number.isFinite(exp) && exp < Date.now() ? null : h;
}

export function saveHandover(conversationId: string | null, action: PartnerService, h: Handover) {
  write({ ...read(), [slot(conversationId, action)]: h });
}

export function removeHandover(conversationId: string | null, action: PartnerService) {
  const all = read();
  delete all[slot(conversationId, action)];
  write(all);
}
