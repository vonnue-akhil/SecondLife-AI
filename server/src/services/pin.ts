// Partner PINs: generation, scrypt hashing, timing-safe checks and wrong-PIN rate limiting.
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { AppError } from '../middleware/errors';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
const FAIL_LIMIT = 5;
const FAIL_WINDOW_MS = 10 * 60 * 1000;

/** A random code from the unambiguous alphabet. */
export function randomCode(length: number): string {
  const bytes = randomBytes(length);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** A readable PIN like K7Q2-M9XP. */
export const generatePin = () => `${randomCode(4)}-${randomCode(4)}`;

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  return `${salt.toString('hex')}:${scryptSync(pin, salt, 32).toString('hex')}`;
}

export function verifyPin(pin: string, stored: string): boolean {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  return timingSafeEqual(scryptSync(pin, Buffer.from(salt, 'hex'), 32), Buffer.from(hash, 'hex'));
}

/** Timing-safe string comparison of any two lengths. */
export function safeEqual(a: string, b: string): boolean {
  const ha = scryptSync(a, 'sl-cmp', 32);
  const hb = scryptSync(b, 'sl-cmp', 32);
  return timingSafeEqual(ha, hb);
}

const failures = new Map<string, number[]>();

/** Throws 429 after 5 wrong PINs in 10 minutes for this partner. */
export function assertNotLimited(partnerId: string): void {
  const recent = (failures.get(partnerId) ?? []).filter((t) => Date.now() - t < FAIL_WINDOW_MS);
  if (recent.length) failures.set(partnerId, recent);
  else failures.delete(partnerId);
  if (recent.length >= FAIL_LIMIT) throw new AppError('RATE_LIMITED', 429, 'Too many wrong PINs. Please wait a few minutes and try again.');
}

export function recordFailure(partnerId: string): void {
  failures.set(partnerId, [...(failures.get(partnerId) ?? []), Date.now()]);
}

export function clearFailures(partnerId: string): void {
  failures.delete(partnerId);
}
