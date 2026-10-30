import { env } from '../config';
import { metaApiAvailable } from './meta-responses';
import { mockAssessmentProvider } from './mock/assessment.provider';
import { mockSegmentationProvider } from './mock/segmentation.provider';
import { createMuseAssessmentProvider } from './muse/assessment.provider';
import { museHost } from './muse/client';
import { createMuseResourceFinder } from './muse/resource-finder';
import { createSam3SegmentationProvider } from './sam/segmentation.provider';
import type { AssessmentProvider, ResourceFinder, SegmentationProvider, SpeechToText } from './types';
import { createMuseVoiceTranscriber } from './voice/transcriber';

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
    if (metaApiAvailable()) return createSam3SegmentationProvider();
    console.warn('[providers] SEGMENTATION_PROVIDER=sam3 but MODEL_API_KEY is not set; using the sample regions');
  }
  return mockSegmentationProvider;
}

/** Web search runs on the Responses API, which only the Meta Model API serves. Off in the scripted demo. */
function chooseResourceFinder(): ResourceFinder | null {
  if (assessmentProvider.isMock || !metaApiAvailable()) return null;
  return createMuseResourceFinder();
}

/** Muse Voice Transcribe on the Meta Model API. Off in the scripted demo, like web search. */
function chooseSpeechToText(): SpeechToText | null {
  if (assessmentProvider.isMock || !metaApiAvailable()) return null;
  return createMuseVoiceTranscriber();
}

export const assessmentProvider = chooseAssessment();
export const segmentationProvider = chooseSegmentation();
export const resourceFinder = chooseResourceFinder();
export const speechToText = chooseSpeechToText();

console.log(
  `[providers] assessment: ${assessmentProvider.name}, segmentation: ${segmentationProvider.name}, web search: ${resourceFinder?.name ?? 'off'}, speech: ${speechToText?.name ?? 'off'}`,
);
