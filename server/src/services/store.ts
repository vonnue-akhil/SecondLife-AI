// The one JSON data file: registered partners, offered rewards, wallets, handovers and redemptions.
// Held in memory, persisted with a short debounce and an atomic write. Never holds messages, photos or PINs.
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { PartnerSchema, PartnerServiceSchema, RewardSchema, WalletEntrySchema } from '../../../shared/schemas';
import { ROOT_DIR, env } from '../config';

const StoredPartnerSchema = PartnerSchema.extend({
  status: z.enum(['pending', 'approved']),
  pinHash: z.string(), // "salt:hash", both hex
  createdAt: z.string(),
});
const StoredWalletSchema = z.object({ points: z.number().int().min(0), demoPoints: z.number().int().min(0), history: z.array(WalletEntrySchema) });
const StoredHandoverSchema = z.object({
  code: z.string(),
  walletId: z.string(),
  action: PartnerServiceSchema,
  partnerId: z.string(),
  partnerName: z.string(),
  points: z.number().int().positive(),
  demo: z.boolean(),
  device: z.string(),
  conversationId: z.string().optional(), // an open code is reused for the same partner, service and conversation
  status: z.enum(['open', 'confirmed', 'expired']),
  expiresAt: z.string(),
});
const StoredRedemptionSchema = z.object({ code: z.string(), walletId: z.string(), reward: RewardSchema, used: z.boolean(), at: z.string() });

const DataSchema = z.object({
  partners: z.record(z.string(), StoredPartnerSchema).default({}),
  rewards: z.record(z.string(), RewardSchema).default({}), // offered by real partners
  wallets: z.record(z.string(), StoredWalletSchema).default({}),
  handovers: z.record(z.string(), StoredHandoverSchema).default({}),
  redemptions: z.record(z.string(), StoredRedemptionSchema).default({}),
});
export type StoredPartner = z.infer<typeof StoredPartnerSchema>;
export type StoredWallet = z.infer<typeof StoredWalletSchema>;
export type StoredHandover = z.infer<typeof StoredHandoverSchema>;
export type StoredRedemption = z.infer<typeof StoredRedemptionSchema>;

const DIR = path.resolve(ROOT_DIR, env.DATA_DIR);
const FILE = path.join(DIR, 'secondlife.json');
const DEBOUNCE_MS = 200;

function load(): z.infer<typeof DataSchema> {
  fs.mkdirSync(DIR, { recursive: true });
  if (!fs.existsSync(FILE)) return DataSchema.parse({});
  try {
    return DataSchema.parse(JSON.parse(fs.readFileSync(FILE, 'utf8')));
  } catch {
    const moved = `${FILE}.corrupt-${Date.now()}`;
    fs.renameSync(FILE, moved);
    console.warn(`[store] data file was unreadable; moved to ${path.basename(moved)} and starting empty`);
    return DataSchema.parse({});
  }
}

export const data = load();

let timer: NodeJS.Timeout | null = null;
let writing: Promise<void> = Promise.resolve();

function writeNow(): Promise<void> {
  writing = writing.then(async () => {
    const tmp = `${FILE}.tmp`;
    try {
      await fs.promises.writeFile(tmp, JSON.stringify(data));
      await fs.promises.rename(tmp, FILE);
    } catch (err) {
      console.error('[store] write failed:', err instanceof Error ? err.message : String(err));
    }
  });
  return writing;
}

/** Call after every change. */
export function persist(): void {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void writeNow();
  }, DEBOUNCE_MS);
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
    await writeNow();
  } else await writing;
}

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.once(sig, () => void flush().finally(() => process.exit(0)));
}
