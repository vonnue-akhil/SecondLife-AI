import type { AssistantTurn, DamageArea, DamageRegion, DeviceObservations, Resource } from '../../../shared/schemas';
import type { Session } from '../services/session.store';

/** An upload that passed validation. Held in memory for the current request only. */
export interface PreparedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  sha256: string;
}

/** A video clip that passed validation (MP4/MOV, within the size and length limits). Request-scoped, like images. */
export interface PreparedVideo {
  buffer: Buffer;
  mimeType: 'video/mp4' | 'video/quicktime';
  durationMs: number;
  sha256: string;
}

export interface AssessmentProvider {
  name: string; // shown in the UI mode badge
  isMock: boolean;
  supportsImages: boolean;
  supportsVideo: boolean;
  observeImage(image: PreparedImage, userText: string): Promise<DeviceObservations>;
  /** Only called when supportsVideo is true. */
  observeVideo(video: PreparedVideo, userText: string): Promise<DeviceObservations>;
  respond(session: Session, userMessage: string): Promise<AssistantTurn>;
}

export interface SegmentationProvider {
  name: string;
  isMock: boolean;
  segment(image: PreparedImage, areas: DamageArea[]): Promise<DamageRegion[]>;
}

/** Finds official web pages for a recommendation that the curated list does not cover. */
export interface ResourceFinder {
  name: string;
  /** Returns source 'web' resources only, each URL taken from a real search result. */
  find(session: Session, curated: Resource[], signal: AbortSignal): Promise<Resource[]>;
}

/** Speech to text for the composer's mic button. */
export interface SpeechToText {
  name: string;
  /** `wav` is mono 16-bit PCM at 16 or 24 kHz, already validated. Returns the transcript ('' when silent). */
  transcribe(wav: Buffer, signal: AbortSignal): Promise<string>;
}
