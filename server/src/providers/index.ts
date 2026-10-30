import { env } from '../config';
import { mockAssessmentProvider } from './mock/assessment.provider';
import { mockSegmentationProvider } from './mock/segmentation.provider';
import { createMuseAssessmentProvider } from './muse/assessment.provider';
import { museHost } from './muse/client';
import type { AssessmentProvider, SegmentationProvider } from './types';

function chooseAssessment(): AssessmentProvider {
  if (env.AI_PROVIDER === 'muse') {
    const host = museHost();
    if (host) {
      console.log(`[providers] Muse Spark: ${host.model} via ${host.label}`);
      return createMuseAssessmentProvider(host);
    }
    const key = env.MUSE_HOST === 'baseten' ? 'BASETEN_API_KEY' : 'MODEL_API_KEY';
    console.warn(`[providers] AI_PROVIDER=muse but ${key} is not set; using the scripted demo`);
  }
  return mockAssessmentProvider;
}

function chooseSegmentation(): SegmentationProvider {
  if (env.SEGMENTATION_PROVIDER === 'sam3') {
    console.warn('[providers] SAM 3 provider is not built yet; using the sample regions');
  }
  return mockSegmentationProvider;
}

export const assessmentProvider = chooseAssessment();
export const segmentationProvider = chooseSegmentation();

console.log(`[providers] assessment: ${assessmentProvider.name}, segmentation: ${segmentationProvider.name}`);
