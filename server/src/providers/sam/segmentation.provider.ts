// SAM 3.1 on the Meta Model API (https://dev.meta.ai/docs/sam/segmenting.md): one request per damage concept,
// run in parallel, each outlining every region the concept matches. Streams are parsed with Meta's @meta-sam/parser.
import { parseImageStream, recordsOfKind } from '@meta-sam/parser';
import { env } from '../../config';
import type { DamageRegion } from '../../../../shared/schemas';
import { streamResponse } from '../meta-responses';
import type { SegmentationProvider } from '../types';
import { maskToPolygons } from './polygons';

const MAX_CONCEPTS = 4;
const REQUEST_TIMEOUT_MS = 9000; // under the 10 s cap the conversation service applies

export function createSam3SegmentationProvider(): SegmentationProvider {
  return {
    name: 'SAM 3.1',
    isMock: false,
    async segment(image, concepts) {
      const unique = [...new Map(concepts.map((c) => [c.trim().toLowerCase(), c.trim()] as const)).entries()]
        .filter(([key]) => key)
        .map(([, concept]) => concept)
        .slice(0, MAX_CONCEPTS);
      if (unique.length === 0) return [];

      const imageUrl = `data:${image.mimeType};base64,${image.buffer.toString('base64')}`;
      const settled = await Promise.allSettled(unique.map((concept) => segmentConcept(concept, imageUrl, image.width, image.height)));

      const regions: DamageRegion[] = [];
      let failures = 0;
      settled.forEach((result, i) => {
        if (result.status === 'fulfilled') regions.push(...result.value);
        else {
          failures++;
          console.warn(`[sam] "${unique[i]}" failed: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
        }
      });
      if (failures === unique.length) throw new Error('SAM 3.1 failed for every concept');
      return regions;
    },
  };
}

async function segmentConcept(concept: string, imageUrl: string, width: number, height: number): Promise<DamageRegion[]> {
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
    return polygons.length ? [{ concept, polygons, score: record.confidence ?? 1 }] : [];
  });
  console.log(`[sam] "${concept}": ${masks.length} match(es), ${regions.length} kept, ${Date.now() - started} ms (${result.outcome.status})`);
  return regions;
}
