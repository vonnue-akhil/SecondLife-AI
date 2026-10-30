import path from 'node:path';
import { z } from 'zod';

// Load .env from the repo root when present. npm scripts always run from the root.
try {
  process.loadEnvFile('.env');
} catch {
  // No .env file: rely on the real environment.
}

export const ROOT_DIR = process.cwd();
export const CLIENT_DIST_DIR = path.join(ROOT_DIR, 'client', 'dist');
export const SAMPLES_DIR = path.join(ROOT_DIR, 'client', 'public', 'samples');

// The MVP serves one region plus a small "global" set of curated resources.
export const DEFAULT_REGION = 'IN';

export const SESSION_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_HISTORY_MESSAGES = 20;
export const MAX_FOLLOW_UP_QUESTIONS = 3;
export const MIN_REGION_SCORE = 0.5;

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const optionalString = z.preprocess(blankToUndefined, z.string().trim().optional());
const withDefault = (fallback: string) => z.preprocess(blankToUndefined, z.string().trim().default(fallback));

const EnvSchema = z.object({
  AI_PROVIDER: z.preprocess(blankToUndefined, z.enum(['mock', 'muse']).default('mock')),
  MUSE_HOST: z.preprocess(blankToUndefined, z.enum(['meta', 'baseten']).default('meta')),
  MODEL_API_KEY: optionalString,
  META_API_BASE_URL: withDefault('https://api.meta.ai/v1'),
  META_MODEL_ID: withDefault('muse-spark-1.3'),
  BASETEN_API_KEY: optionalString,
  BASETEN_BASE_URL: withDefault('https://inference.baseten.co/v1'),
  BASETEN_MODEL_ID: withDefault('meta-models/muse-spark-open-1026'),
  SEGMENTATION_PROVIDER: z.preprocess(blankToUndefined, z.enum(['mock', 'sam3']).default('mock')),
  SAM3_HOST: z.preprocess(blankToUndefined, z.enum(['modal', 'hosted']).default('modal')),
  SAM3_API_URL: optionalString,
  SAM3_API_KEY: optionalString,
  MAX_UPLOAD_MB: z.preprocess(blankToUndefined, z.coerce.number().positive().max(20).default(8)),
  PORT: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(65535).default(3001)),
});

const parsed = EnvSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Invalid environment configuration:\n' + z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
