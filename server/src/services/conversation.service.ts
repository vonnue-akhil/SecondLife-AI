import type { ChatResponse, DamageRegion, DeviceObservations, UserLocation } from '../../../shared/schemas';
import { MIN_REGION_SCORE } from '../config';
import { AppError } from '../middleware/errors';
import { assessmentProvider, segmentationProvider } from '../providers';
import type { PreparedImage, PreparedVideo } from '../providers/types';
import { PHOTO_PLACEHOLDER, VIDEO_PLACEHOLDER } from '../providers/mock/facts';
import { detectBrand } from './brand';
import { normaliseTurn } from './recommendation.service';
import { regionOf, resourcesForActions } from './resource.service';
import { applySafety, detectHazard } from './safety.service';
import { createSession, getSession, saveSession, type Session } from './session.store';

const SEGMENTATION_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

const polygonArea = (pts: [number, number][]) => {
  let sum = 0;
  pts.forEach(([x1, y1], i) => {
    const [x2, y2] = pts[(i + 1) % pts.length]!;
    sum += x1 * y2 - x2 * y1;
  });
  return Math.abs(sum) / 2;
};

/** e.g. "highlighted on photo: screen crack (2 areas, ~4% of image)", one entry per concept. */
function summariseRegions(regions: DamageRegion[], image: PreparedImage, what: 'photo' | 'frame'): string[] {
  const byConcept = new Map<string, { areas: number; pixels: number }>();
  for (const r of regions) {
    const entry = byConcept.get(r.concept) ?? { areas: 0, pixels: 0 };
    entry.areas += r.polygons.length;
    entry.pixels += r.polygons.reduce((sum, p) => sum + polygonArea(p as [number, number][]), 0);
    byConcept.set(r.concept, entry);
  }
  return [...byConcept].map(([concept, { areas, pixels }]) => {
    const pct = (pixels / (image.width * image.height)) * 100;
    const share = pct < 1 ? '<1%' : `~${Math.round(pct)}%`;
    return `highlighted on ${what === 'frame' ? 'a frame of the video' : 'photo'}: ${concept} (${areas} area${areas === 1 ? '' : 's'}, ${share} of image)`;
  });
}

/**
 * Runs one conversational turn: load or create the session, analyse and segment the photo,
 * check safety, ask the provider, then validate, enrich and store the result.
 */
export async function runChatTurn(input: {
  message: string;
  conversationId?: string;
  /** The photo, or the poster frame the browser took from the video. */
  image: PreparedImage | null;
  video?: PreparedVideo | null;
  location: UserLocation | null;
}): Promise<ChatResponse> {
  const { message, conversationId, image, location } = input;
  const video = input.video ?? null;

  // Load or create the session; work on a copy so a failed request leaves the stored one untouched.
  const existing = conversationId ? getSession(conversationId) : null;
  const session: Session = existing ? structuredClone(existing) : createSession();
  session.location = location;

  let imageAnalysed = false;
  let videoAnalysed = false;
  let newRegions: DamageRegion[] = [];
  if (image || video) {
    let observed = false;
    try {
      const observations: DeviceObservations = video
        ? await assessmentProvider.observeVideo(video, message)
        : await assessmentProvider.observeImage(image!, message);
      session.observations = observations;
      observed = true;
      if (video) videoAnalysed = true;
      else imageAnalysed = true;
    } catch (err) {
      console.error(`[chat] ${video ? 'observeVideo' : 'observeImage'} failed; continuing with text only:`, err instanceof Error ? err.message : err);
    }

    // Outlines are drawn on the photo, or on the video's poster frame; no poster means no outlines.
    if (observed && image && session.observations && session.observations.damageConcepts.length > 0) {
      try {
        const found = await withTimeout(segmentationProvider.segment(image, session.observations.damageConcepts), SEGMENTATION_TIMEOUT_MS);
        newRegions = found.filter((r) => r.score >= MIN_REGION_SCORE && r.polygons.length > 0);
      } catch (err) {
        console.error('[chat] segmentation failed; continuing without regions:', err instanceof Error ? err.message : err);
      }
    }
    if (observed) {
      session.damageRegions = newRegions;
      if (newRegions.length > 0 && image && session.observations) {
        session.observations.visibleCondition.push(...summariseRegions(newRegions, image, video ? 'frame' : 'photo'));
      }
    }
  }

  session.messages.push({ role: 'user', text: message || (video ? VIDEO_PLACEHOLDER : PHOTO_PLACEHOLDER) });

  const hazard = detectHazard(session);

  let candidate;
  try {
    candidate = await assessmentProvider.respond(session, message);
  } catch (err) {
    if (err instanceof AppError) throw err;
    console.error('[chat] provider failed:', err instanceof Error ? err.message : err);
    throw new AppError('PROVIDER_ERROR', 502, "The assistant couldn't respond just now. Please try again.");
  }

  const turn = applySafety(normaliseTurn(candidate), hazard);
  const resources = turn.stage === 'recommending'
    ? resourcesForActions(
        turn.recommendations.map((r) => r.action),
        regionOf(session),
        detectBrand(session),
      )
    : [];

  session.messages.push({
    role: 'assistant',
    text: turn.followUpQuestion ? `${turn.message}\n${turn.followUpQuestion}` : turn.message,
  });
  if (turn.stage === 'gathering' && turn.followUpQuestion) session.followUpsAsked += 1;
  if (turn.stage === 'recommending') {
    session.lastRecommendation = turn;
    session.webResources = null;
  }
  saveSession(session);

  const body: ChatResponse = {
    conversationId: session.id,
    turn,
    resources,
    damageRegions: newRegions,
    providers: {
      assessment: { name: assessmentProvider.name, isMock: assessmentProvider.isMock },
      segmentation: { name: segmentationProvider.name, isMock: segmentationProvider.isMock },
    },
    imageAnalysed,
    videoAnalysed,
  };
  console.log(`[chat] ${session.id.slice(0, 8)} stage=${turn.stage} image=${image ? (imageAnalysed ? 'analysed' : video ? 'poster' : 'failed') : 'none'} video=${video ? (videoAnalysed ? 'analysed' : 'failed') : 'none'} regions=${newRegions.length}`);
  return body;
}
