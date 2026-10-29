import { env } from '../config';
import { mockAssessmentProvider } from './mock/assessment.provider';
import { mockSegmentationProvider } from './mock/segmentation.provider';
import type { AssessmentProvider, SegmentationProvider } from './types';

function chooseAssessment(): AssessmentProvider {
  if (env.AI_PROVIDER === 'muse') {
    console.warn('[providers] Muse Spark provider is not built yet; using the scripted demo');
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
