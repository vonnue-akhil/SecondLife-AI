// API contract shared by the server and the client. Every type is inferred
// from its Zod schema so the two sides cannot drift apart.
import { z } from 'zod';

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

export const DeviceObservationsSchema = z.object({
  deviceType: z.string(), // e.g. "smartphone", or "unknown"
  brandModelGuess: z.string().nullable(),
  visibleCondition: z.array(z.string()), // e.g. ["cracked screen", "scuffed corners"]
  possibleHazards: z.array(z.string()), // e.g. ["back panel appears raised"]
  damageConcepts: z.array(z.string()).max(4), // short noun phrases for SAM 3; may be empty for an undamaged device
  confidence: ConfidenceSchema,
});
export type DeviceObservations = z.infer<typeof DeviceObservationsSchema>;

export const PointSchema = z.tuple([z.number(), z.number()]);

export const DamageRegionSchema = z.object({
  concept: z.string(), // e.g. "screen crack"
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
});
export type Resource = z.infer<typeof ResourceSchema>;

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
});
export type ChatResponse = z.infer<typeof ChatResponseSchema>;

/** Text fields of the multipart POST /api/v1/chat body. The image travels as the `image` file field. */
export const ChatFieldsSchema = z.object({
  message: z.string().trim().max(2000).default(''),
  conversationId: z.string().trim().min(1).max(100).optional(),
});
export type ChatFields = z.infer<typeof ChatFieldsSchema>;

export const HealthResponseSchema = z.object({
  ok: z.boolean(),
  provider: z.string(),
  isMock: z.boolean(),
  supportsImages: z.boolean(),
});
export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const OutcomeValueSchema = z.enum(['repaired', 'reused', 'donated', 'sold', 'recycled', 'undecided']);
export type OutcomeValue = z.infer<typeof OutcomeValueSchema>;

export const OutcomeRequestSchema = z.object({
  conversationId: z.string().trim().min(1).max(100),
  outcome: OutcomeValueSchema,
});
export type OutcomeRequest = z.infer<typeof OutcomeRequestSchema>;

export const ResourcesQuerySchema = z.object({
  region: z.string().trim().max(20).optional(),
  action: ActionSchema.optional(),
});

export const ApiErrorCodeSchema = z.enum([
  'INVALID_INPUT',
  'IMAGE_TOO_LARGE',
  'UNSUPPORTED_IMAGE',
  'PROVIDER_TIMEOUT',
  'PROVIDER_ERROR',
  'NOT_FOUND', // unknown route, or an expired conversation when recording an outcome
  'INTERNAL_ERROR', // anything unexpected that is not the provider's fault
]);
export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export interface ApiErrorBody {
  error: { code: ApiErrorCode; message: string };
}
