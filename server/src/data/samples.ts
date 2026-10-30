import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { DamageRegionSchema, DeviceObservationsSchema } from '../../../shared/schemas';
import { SAMPLES_DIR } from '../config';
import samplesJson from './sample-regions.json';

const SampleSchema = z.object({
  id: z.string(),
  file: z.string(),
  width: z.number(),
  height: z.number(),
  observations: DeviceObservationsSchema,
  regions: z.array(DamageRegionSchema),
});
export type Sample = z.infer<typeof SampleSchema>;

const samples = z.array(SampleSchema).parse(samplesJson); // fail fast on a malformed file
const byHash = new Map<string, Sample>();
const missing = new Set<Sample>(samples);

function indexSamples() {
  for (const sample of [...missing]) {
    const file = path.join(SAMPLES_DIR, sample.file);
    if (!fs.existsSync(file)) continue;
    byHash.set(createHash('sha256').update(fs.readFileSync(file)).digest('hex'), sample);
    missing.delete(sample);
  }
}

indexSamples();
for (const s of missing) console.warn(`[samples] ${s.file} not found in ${SAMPLES_DIR}; its regions are unavailable until it is added`);

/** The bundled sample photo with this exact content hash, if any. */
export function findSample(sha256: string): Sample | null {
  let hit = byHash.get(sha256);
  if (!hit && missing.size > 0) {
    indexSamples(); // photos may be added while the dev server runs
    hit = byHash.get(sha256);
  }
  return hit ?? null;
}
