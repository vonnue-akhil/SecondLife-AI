import { findSample } from '../../data/samples';
import type { SegmentationProvider } from '../types';

/** Returns pre-traced regions for the bundled sample photos only. Never draws on a user's own photo. */
export const mockSegmentationProvider: SegmentationProvider = {
  name: 'Sample regions',
  isMock: true,
  async segment(image, concepts) {
    const sample = findSample(image.sha256);
    if (!sample) return [];
    const wanted = new Set(concepts.map((c) => c.toLowerCase()));
    const matching = sample.regions.filter((r) => wanted.has(r.concept.toLowerCase()));
    return matching.length > 0 ? matching : sample.regions;
  },
};
