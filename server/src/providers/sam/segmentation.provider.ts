// SAM 3.1 on the Meta Model API (https://dev.meta.ai/docs/sam/segmenting.md): one request per damage concept,
// run in parallel, each outlining every region the concept matches. Streams are parsed with Meta's @meta-sam/parser.
import { parseImageStream, recordsOfKind } from '@meta-sam/parser';
import { env } from '../../config';
import type { DamageArea, DamageRegion } from '../../../../shared/schemas';
import { streamResponse } from '../meta-responses';
import type { SegmentationProvider } from '../types';
import { maskToPolygons } from './polygons';

const MAX_CONCEPTS = 4;
const REQUEST_TIMEOUT_MS = 9000; // under the 10 s cap the conversation service applies

/** One entry per part, so a screen that is both cracked and showing lines is outlined once with both labels. */
function mergeByPart(areas: DamageArea[]): DamageArea[] {
  const byPart = new Map<string, { part: string; labels: string[] }>();
  for (const { part, label } of areas) {
    const key = part.trim().toLowerCase();
    if (!key) continue;
    const entry = byPart.get(key) ?? { part: part.trim(), labels: [] };
    const text = label.trim() || part.trim();
    if (!entry.labels.some((l) => l.toLowerCase() === text.toLowerCase())) entry.labels.push(text);
    byPart.set(key, entry);
  }
  return [...byPart.values()].map(({ part, labels }) => ({ part, label: labels.join(', ') }));
}

export function createSam3SegmentationProvider(): SegmentationProvider {
  return {
    name: 'SAM 3.1',
    isMock: false,
    async segment(image, areas) {
      const unique = mergeByPart(areas).slice(0, MAX_CONCEPTS);
      if (unique.length === 0) return [];

      const imageUrl = `data:${image.mimeType};base64,${image.buffer.toString('base64')}`;
      const settled = await Promise.allSettled(unique.map((area) => segmentConcept(area, imageUrl, image.width, image.height)));

      const regions: DamageRegion[] = [];
      let failures = 0;
      settled.forEach((result, i) => {
        if (result.status === 'fulfilled') regions.push(...result.value);
        else {
          failures++;
          console.warn(`[sam] "${unique[i]!.part}" failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }
      });
      if (failures === unique.length) throw new Error('SAM 3.1 failed for every concept');
      return regions;
    },
  };
}

async function segmentConcept({ part: concept, label }: DamageArea, imageUrl: string, width: number, height: number): Promise<DamageRegion[]> {
  const started = Date.now();
  const events = streamResponse(
    {
      model: env.SAM_MODEL_ID,
      input: [
        {
          type: 'message',
          role: 'user',
          content: [
            { type: 'input_text', text: concept },
            { type: 'input_image', image_url: imageUrl },
          ],
        },
      ],
      metadata: { mask_encoding: 'one_bit', include_confidence: 'true' },
    },
    AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  );
  const result = await parseImageStream(events).finalResult;
  // Zero matches is normal; an incomplete stream is treated the same.
  const masks = result.outcome.status === 'completed' ? recordsOfKind(result.records, 'mask') : [];
  const regions = masks.flatMap((record): DamageRegion[] => {
    const polygons = maskToPolygons(record, width, height);
    return polygons.length ? [{ concept, label, polygons, score: record.confidence ?? 1 }] : [];
  });
  console.log(`[sam] "${concept}" (${label}): ${masks.length} match(es), ${regions.length} kept, ${Date.now() - started} ms (${result.outcome.status})`);
  return regions;
}
