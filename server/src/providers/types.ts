import type { AssistantTurn, DamageRegion, DeviceObservations } from '../../../shared/schemas';
import type { Session } from '../services/session.store';

/** An upload that passed validation. Held in memory for the current request only. */
export interface PreparedImage {
  buffer: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  width: number;
  height: number;
  sha256: string;
}

export interface AssessmentProvider {
  name: string; // shown in the UI mode badge
  isMock: boolean;
  supportsImages: boolean;
  observeImage(image: PreparedImage, userText: string): Promise<DeviceObservations>;
  respond(session: Session, userMessage: string): Promise<AssistantTurn>;
}

export interface SegmentationProvider {
  name: string;
  isMock: boolean;
  segment(image: PreparedImage, concepts: string[]): Promise<DamageRegion[]>;
}
