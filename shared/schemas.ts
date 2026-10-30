// API contract shared by the server and the client. Every type is inferred
// from its Zod schema so the two sides cannot drift apart.
import { z } from 'zod';
import { STATE_CODES } from './india-states';

// ---------------------------------------------------------------------------
// Assistant turn (what the model produces, mock or real)
// ---------------------------------------------------------------------------

export const ActionSchema = z.enum(['repair', 'reuse', 'donate', 'resell', 'recycle', 'stop_use']);
export type Action = z.infer<typeof ActionSchema>;

export const ConfidenceSchema = z.enum(['low', 'medium', 'high']);
export type Confidence = z.infer<typeof ConfidenceSchema>;

export const RecommendationSchema = z.object({
  action: ActionSchema,
  rank: z.number().int().min(1),
  title: z.string(), // e.g. "Get the screen repaired"
  reason: z.string(),
  nextSteps: z.array(z.string()).min(1),
  confidence: ConfidenceSchema,
  limitations: z.array(z.string()),
});
export type Recommendation = z.infer<typeof RecommendationSchema>;

export const StageSchema = z.enum(['gathering', 'recommending', 'follow_up']);
export type Stage = z.infer<typeof StageSchema>;

export const AssistantTurnSchema = z.object({
  stage: StageSchema,
  message: z.string(),
  followUpQuestion: z.string().nullable(),
  quickReplies: z.array(z.string()).max(4).default([]),
  recommendations: z.array(RecommendationSchema).default([]), // non-empty only when stage = recommending
  safetyWarnings: z.array(z.string()).default([]),
});
export type AssistantTurn = z.infer<typeof AssistantTurnSchema>;

// ---------------------------------------------------------------------------
// Image understanding
// ---------------------------------------------------------------------------

// SAM 3.1 finds parts, not defects, so what it outlines and what the user is told are separate.
export const DamageAreaSchema = z.object({
  part: z.string(), // the noun phrase SAM outlines, e.g. "phone screen"
  label: z.string(), // what's wrong with it, shown on the outline, e.g. "display lines and dark patches"
});
export type DamageArea = z.infer<typeof DamageAreaSchema>;

export const DeviceObservationsSchema = z.object({
  deviceType: z.string(), // e.g. "smartphone", or "unknown"
  brandModelGuess: z.string().nullable(),
  visibleCondition: z.array(z.string()), // e.g. ["cracked screen", "scuffed corners"]
  possibleHazards: z.array(z.string()), // e.g. ["back panel appears raised"]
  damageAreas: z.array(DamageAreaSchema).max(4), // one per damaged part; may be empty for an undamaged device
  confidence: ConfidenceSchema,
});
export type DeviceObservations = z.infer<typeof DeviceObservationsSchema>;

export const PointSchema = z.tuple([z.number(), z.number()]);

export const DamageRegionSchema = z.object({
  concept: z.string(), // the part SAM outlined, e.g. "phone screen"
  label: z.string(), // what's wrong with it, e.g. "display lines"
  polygons: z.array(z.array(PointSchema)), // pixel coordinates in the uploaded image
  score: z.number().min(0).max(1),
});
export type DamageRegion = z.infer<typeof DamageRegionSchema>;

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export const ResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.url(),
  region: z.string(), // "global" or a region code such as "IN"
  actions: z.array(ActionSchema).min(1), // which recommendations it supports
  description: z.string(), // one line
  source: z.enum(['curated', 'web']),
  citationUrl: z.url().nullable(), // required when source = 'web'
  lastVerified: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), // curated only
  brands: z.array(z.string()).optional(), // lowercase brand keys, e.g. ["samsung"]; absent = any brand
});
export type Resource = z.infer<typeof ResourceSchema>;

// ---------------------------------------------------------------------------
// Location (optional and coarse: coordinates never leave the device)
// ---------------------------------------------------------------------------

const PlaceNameSchema = z.string().trim().min(1).max(80).regex(/^[\p{L}\p{M}\p{N} .,'()&-]+$/u);

export const UserLocationSchema = z.object({
  state: z.enum(STATE_CODES),
  district: PlaceNameSchema.nullable(), // from the on-device lookup only
  place: PlaceNameSchema.nullable(), // the nearest town, or a city the user typed
  source: z.enum(['device', 'manual']),
});
export type UserLocation = z.infer<typeof UserLocationSchema>;

// ---------------------------------------------------------------------------
// API: requests and responses
// ---------------------------------------------------------------------------

export const ProviderInfoSchema = z.object({ name: z.string(), isMock: z.boolean() });
export type ProviderInfo = z.infer<typeof ProviderInfoSchema>;

export const ChatResponseSchema = z.object({
  conversationId: z.string(),
  turn: AssistantTurnSchema,
  resources: z.array(ResourceSchema), // curated + cited web results
  damageRegions: z.array(DamageRegionSchema), // from segmentation; empty when none or unavailable
  providers: z.object({ assessment: ProviderInfoSchema, segmentation: ProviderInfoSchema }),
  imageAnalysed: z.boolean(),
  videoAnalysed: z.boolean(), // Muse Spark watched an attached video clip
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/** Text fields of the multipart POST /api/v1/chat body. The image travels as the `image` file field. */
export const ChatFieldsSchema = z.object({
  message: z.string().trim().max(2000).default(''),
  conversationId: z.string().trim().min(1).max(100).optional(),
  // JSON-encoded UserLocation, sent only when the user has shared one. A malformed value is dropped
  // rather than failing the message.
  location: z
    .preprocess((v) => {
      try {
        return typeof v === 'string' ? JSON.parse(v) : v;
      } catch {
        return v;
      }
    }, UserLocationSchema)
    .optional()
    .catch(undefined),
});
export type ChatFields = z.infer<typeof ChatFieldsSchema>;

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.string(),
  isMock: z.boolean(),
  supportsImages: z.boolean(),
  supportsVideo: z.boolean(), // POST /chat accepts a `video` clip (MP4/MOV)
  speechToText: z.boolean(), // POST /transcribe is available
  webSearch: z.boolean(), // POST /resources/search can find extra official links
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

/** POST /api/v1/transcribe: multipart with one `audio` file (mono 16-bit PCM WAV, 16 or 24 kHz). */
export const TranscribeResponseSchema = z.object({
  text: z.string(), // may be empty when no speech was heard
});
export type TranscribeResponse = z.infer<typeof TranscribeResponseSchema>;

export const OutcomeValueSchema = z.enum(['repaired', 'reused', 'donated', 'sold', 'recycled', 'undecided']);
export type OutcomeValue = z.infer<typeof OutcomeValueSchema>;

export const OutcomeRequestSchema = z.object({
  conversationId: z.string().trim().min(1).max(100),
  outcome: OutcomeValueSchema,
});
export type OutcomeRequest = z.infer<typeof OutcomeRequestSchema>;

/** POST /api/v1/resources/search: web search for official links that the curated list lacks. */
export const ResourceSearchRequestSchema = z.object({
  conversationId: z.string().trim().min(1).max(100),
});
export type ResourceSearchRequest = z.infer<typeof ResourceSearchRequestSchema>;

export const ResourceSearchResponseSchema = z.object({
  resources: z.array(ResourceSchema), // source 'web' only; the turn's curated links are not repeated
  searched: z.boolean(), // false when web search is unavailable (no Meta key) or there was nothing to search for
});
export type ResourceSearchResponse = z.infer<typeof ResourceSearchResponseSchema>;

// ---------------------------------------------------------------------------
// Partners, points and rewards
//
// Partners are repair shops and collection points. Demo partners are fictional listings for the hackathon
// demo: always labelled, never with contact details, and their points ("demo points") can only buy demo
// rewards. Real partners register with consent and are listed only after approval.
//
// Points are earned only when a partner confirms a handover: the user gets a one-time code, the partner
// enters it with their PIN. The wallet is anonymous: a random id kept on the device (header `X-Wallet-Id`).
// ---------------------------------------------------------------------------

/** What a partner offers: repairs, taking donated devices to pass on, or taking e-waste to authorised recyclers. */
export const PartnerServiceSchema = z.enum(['repair', 'donate', 'recycle']);
export type PartnerService = z.infer<typeof PartnerServiceSchema>;

/** Points a confirmed handover earns. */
export const HANDOVER_POINTS = { donate: 500, recycle: 50, repair: 25 } as const satisfies Record<PartnerService, number>;

export const PartnerSchema = z.object({
  id: z.string(),
  name: z.string(),
  services: z.array(PartnerServiceSchema).min(1),
  devices: z.array(z.string()), // what they handle, e.g. ["Phones", "TVs", "Washing machines"]
  state: z.enum(STATE_CODES),
  district: z.string().nullable(),
  place: z.string().nullable(), // town or locality
  phone: z.string().nullable(), // always null for demo listings
  whatsapp: z.boolean(), // the phone number takes WhatsApp messages
  demo: z.boolean(),
});
export type Partner = z.infer<typeof PartnerSchema>;

/** GET /api/v1/partners?state=KL&district=Wayanad&service=repair: approved partners, same district first, at most 5. */
export const PartnersQuerySchema = z.object({
  state: z.enum(STATE_CODES).optional(),
  district: PlaceNameSchema.optional(),
  service: PartnerServiceSchema.optional(),
});
export const PartnersResponseSchema = z.object({ partners: z.array(PartnerSchema) });
export type PartnersResponse = z.infer<typeof PartnersResponseSchema>;

/** POST /api/v1/partners: a shop asks to be listed. Listed only after approval. */
export const PartnerRegistrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  services: z.array(PartnerServiceSchema).min(1),
  devices: z.array(z.string().trim().min(1).max(30)).min(1).max(8),
  state: z.enum(STATE_CODES),
  district: PlaceNameSchema.nullable(),
  place: PlaceNameSchema.nullable(),
  phone: z.string().trim().regex(/^\+?[0-9][0-9 -]{8,15}[0-9]$/),
  whatsapp: z.boolean(),
  consent: z.literal(true), // agrees to have the name, area and phone number shown to SecondLife users
});
export type PartnerRegistration = z.infer<typeof PartnerRegistrationSchema>;
/** The PIN is shown once and never stored in plain text. */
export const PartnerRegistrationResponseSchema = z.object({ id: z.string(), pin: z.string(), status: z.literal('pending') });
export type PartnerRegistrationResponse = z.infer<typeof PartnerRegistrationResponseSchema>;

export const RewardSchema = z.object({
  id: z.string(),
  partnerId: z.string(),
  partnerName: z.string(),
  title: z.string(), // e.g. "Free phone health check"
  description: z.string(),
  points: z.number().int().positive(),
  state: z.enum(STATE_CODES),
  district: z.string().nullable(),
  demo: z.boolean(), // costs demo points
});
export type Reward = z.infer<typeof RewardSchema>;

/** GET /api/v1/rewards?state=KL: rewards from approved partners, the user's state first. */
export const RewardsQuerySchema = z.object({ state: z.enum(STATE_CODES).optional() });
export const RewardsResponseSchema = z.object({ rewards: z.array(RewardSchema) });
export type RewardsResponse = z.infer<typeof RewardsResponseSchema>;

export const WalletEntrySchema = z.object({
  kind: z.enum(['earned', 'redeemed']),
  points: z.number().int(), // positive when earned, negative when redeemed
  label: z.string(), // e.g. "Donated a smartphone at Green Leaf Mobile Care"
  demo: z.boolean(),
  at: z.string(), // ISO date-time
});
export type WalletEntry = z.infer<typeof WalletEntrySchema>;

/** GET /api/v1/wallet (header X-Wallet-Id). An unknown wallet is simply empty. */
export const WalletSchema = z.object({
  points: z.number().int().min(0),
  demoPoints: z.number().int().min(0),
  history: z.array(WalletEntrySchema), // newest first, at most 50
});
export type Wallet = z.infer<typeof WalletSchema>;

/** POST /api/v1/handovers (header X-Wallet-Id): a one-time code to show the partner when handing the device over. */
export const HandoverRequestSchema = z.object({
  action: PartnerServiceSchema,
  partnerId: z.string().trim().min(1).max(100),
  conversationId: z.string().trim().min(1).max(100).optional(), // lets the label name the device
});
export type HandoverRequest = z.infer<typeof HandoverRequestSchema>;

export const HandoverStatusSchema = z.enum(['open', 'confirmed', 'expired']);
export const HandoverSchema = z.object({
  code: z.string(), // e.g. "SL-7K4Q9X"
  action: PartnerServiceSchema,
  partnerId: z.string(),
  partnerName: z.string(),
  points: z.number().int().positive(), // earned on confirmation
  demo: z.boolean(),
  status: HandoverStatusSchema,
  expiresAt: z.string(), // ISO date-time
});
export type Handover = z.infer<typeof HandoverSchema>;
// GET /api/v1/handovers/:code (header X-Wallet-Id) returns a Handover, so the client can watch for confirmation.

/** POST /api/v1/rewards/:id/redeem (header X-Wallet-Id): spends points and returns a code for the partner. */
export const RedemptionSchema = z.object({
  code: z.string(), // e.g. "RW-3MX8PQ"
  reward: RewardSchema,
  wallet: WalletSchema,
});
export type Redemption = z.infer<typeof RedemptionSchema>;

// Partner tools. Every request carries the partner's id and PIN.
export const PartnerAuthSchema = z.object({ partnerId: z.string().trim().min(1).max(100), pin: z.string().trim().min(4).max(40) });
/** POST /api/v1/partner/login: checks the PIN. */
export const PartnerLoginResponseSchema = z.object({ partner: PartnerSchema, status: z.enum(['approved', 'pending']) });
/** POST /api/v1/partner/handovers/confirm: credits the user's wallet. */
export const ConfirmHandoverSchema = PartnerAuthSchema.extend({ code: z.string().trim().min(4).max(20) });
export const ConfirmHandoverResponseSchema = z.object({ action: PartnerServiceSchema, points: z.number().int(), device: z.string() });
/** POST /api/v1/partner/redemptions/use: marks a reward code as used. */
export const UseRedemptionSchema = PartnerAuthSchema.extend({ code: z.string().trim().min(4).max(20) });
export const UseRedemptionResponseSchema = z.object({ reward: RewardSchema });
/** POST /api/v1/partner/rewards: an approved partner offers a reward. */
export const OfferRewardSchema = PartnerAuthSchema.extend({
  title: z.string().trim().min(3).max(80),
  description: z.string().trim().max(200),
  points: z.number().int().min(10).max(5000),
});

export const ResourcesQuerySchema = z.object({
  region: z.string().trim().max(20).optional(),
  action: ActionSchema.optional(),
});

export const ApiErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'IMAGE_TOO_LARGE',
  'UNSUPPORTED_IMAGE',
  'VIDEO_TOO_LARGE',
  'UNSUPPORTED_VIDEO', // not MP4/MOV, unreadable, or longer than the limit
  'AUDIO_TOO_LARGE',
  'UNSUPPORTED_AUDIO', // not mono 16-bit PCM WAV at 16 or 24 kHz, or longer than the limit
  'PROVIDER_TIMEOUT',
  'PROVIDER_ERROR',
  'NOT_FOUND', // unknown route, or an expired conversation when recording an outcome
  'UNAUTHORIZED', // wrong or missing partner PIN, admin token or wallet id
  'CONFLICT', // e.g. not enough points, or a code that was already used
  'RATE_LIMITED', // too many wrong PINs
  'INTERNAL_ERROR', // anything unexpected that is not the provider's fault
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}
