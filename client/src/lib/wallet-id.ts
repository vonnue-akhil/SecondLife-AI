// The anonymous wallet id: a random UUID kept on this device only.
const KEY = 'secondlife.walletId';
const UUID = /^[0-9a-f-]{36}$/i;
let memory: string | null = null;

function generate(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined') crypto.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The stored id, created on first use. Falls back to an id held in memory when storage is blocked. */
export function getWalletId(): string {
  if (memory) return memory;
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && UUID.test(saved)) return (memory = saved);
  } catch {
    // Storage blocked: the id lasts for this visit.
  }
  memory = generate();
  try {
    localStorage.setItem(KEY, memory);
  } catch {
    // Same as above.
  }
  return memory;
}
