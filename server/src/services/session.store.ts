import { randomUUID } from 'node:crypto';
import type { AssistantTurn, DamageRegion, DeviceObservations, OutcomeValue } from '../../../shared/schemas';
import { MAX_HISTORY_MESSAGES, SESSION_TTL_MS } from '../config';

export interface Session {
  id: string;
  createdAt: number;
  observations: DeviceObservations | null;
  damageRegions: DamageRegion[];
  messages: { role: 'user' | 'assistant'; text: string }[];
  followUpsAsked: number;
  lastRecommendation: AssistantTurn | null;
  outcome: OutcomeValue | null;
}

// In-memory only. Image bytes are never stored here.
const sessions = new Map<string, { session: Session; lastActive: number }>();

export function createSession(): Session {
  const session: Session = {
    id: randomUUID(),
    createdAt: Date.now(),
    observations: null,
    damageRegions: [],
    messages: [],
    followUpsAsked: 0,
    lastRecommendation: null,
    outcome: null,
  };
  sessions.set(session.id, { session, lastActive: Date.now() });
  return session;
}

/** Returns the session, or null when it is unknown or expired. */
export function getSession(id: string): Session | null {
  const entry = sessions.get(id);
  if (!entry) return null;
  if (Date.now() - entry.lastActive > SESSION_TTL_MS) {
    sessions.delete(id);
    return null;
  }
  return entry.session;
}

/** Stores the session, marks it active and caps its history. */
export function saveSession(session: Session): void {
  if (session.messages.length > MAX_HISTORY_MESSAGES) {
    session.messages = session.messages.slice(-MAX_HISTORY_MESSAGES);
  }
  sessions.set(session.id, { session, lastActive: Date.now() });
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of sessions) {
    if (now - entry.lastActive > SESSION_TTL_MS) sessions.delete(id);
  }
}, 10 * 60 * 1000).unref();
