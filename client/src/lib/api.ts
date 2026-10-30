import type {
  ApiErrorBody,
  ApiErrorCode,
  ChatResponse,
  HealthResponse,
  OutcomeValue,
  UserLocation,
} from '../../../shared/schemas';

const API_BASE = '/api/v1';
/** A real model can take up to ~55 s; leave headroom for the upload. */
const CHAT_TIMEOUT_MS = 70_000;
const SHORT_TIMEOUT_MS = 10_000;

export type ClientErrorCode = ApiErrorCode | 'NETWORK' | 'TIMEOUT' | 'BAD_RESPONSE';

/** Errors that would fail again if the identical request were resent. */
const NOT_RETRYABLE = new Set<ClientErrorCode>(['INVALID_INPUT', 'IMAGE_TOO_LARGE', 'UNSUPPORTED_IMAGE']);

const FRIENDLY: Record<ClientErrorCode, string> = {
  INVALID_INPUT: 'That message couldn’t be sent. Please check it and try again.',
  IMAGE_TOO_LARGE: 'That photo is too large to upload. Please try a smaller one.',
  UNSUPPORTED_IMAGE: 'That photo format isn’t supported. Please attach a JPEG, PNG or WebP image.',
  PROVIDER_TIMEOUT: 'The assistant took too long to reply. Please try again.',
  PROVIDER_ERROR: 'The assistant is having trouble right now. Please try again in a moment.',
  NOT_FOUND: 'We couldn’t find that conversation. Please try again.',
  INTERNAL_ERROR: 'Something went wrong on our side. Please try again.',
  NETWORK: 'Couldn’t reach SecondLife AI. Check your connection and try again.',
  TIMEOUT: 'This is taking longer than expected. Please try again.',
  BAD_RESPONSE: 'We got a reply we couldn’t read. Please try again.',
};

export class ApiError extends Error {
  readonly retryable: boolean;

  constructor(
    readonly code: ClientErrorCode,
    message: string,
    /** HTTP status, or null when no response arrived. */
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.retryable = !NOT_RETRYABLE.has(code);
  }
}

/** The server's message is user-safe; we prefer it where it carries specifics about the input. */
function messageFor(code: ClientErrorCode, serverMessage?: string): string {
  if (serverMessage && NOT_RETRYABLE.has(code)) return serverMessage;
  return FRIENDLY[code];
}

function isErrorBody(body: unknown): body is ApiErrorBody {
  const error = (body as ApiErrorBody | null)?.error;
  return !!error && typeof error.code === 'string' && error.code in FRIENDLY;
}

async function readJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return undefined;
  }
}

async function request(path: string, init: RequestInit, timeoutMs: number, signal?: AbortSignal): Promise<unknown> {
  // Combine the caller's signal with a timeout by hand (AbortSignal.any is too new for older phones).
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    let res: Response;
    try {
      res = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers: { Accept: 'application/json', ...init.headers },
        signal: controller.signal,
      });
    } catch (err) {
      if (signal?.aborted) throw err; // caller cancelled: let them ignore it
      const code = timedOut ? 'TIMEOUT' : 'NETWORK';
      throw new ApiError(code, FRIENDLY[code], null);
    }

    const body = await readJson(res);
    if (res.ok) return body;

    if (isErrorBody(body)) {
      throw new ApiError(body.error.code, messageFor(body.error.code, body.error.message), res.status);
    }
    // No contract-shaped body: usually a proxy in between, or the API isn't running.
    if (res.status === 413) throw new ApiError('IMAGE_TOO_LARGE', FRIENDLY.IMAGE_TOO_LARGE, 413);
    if (res.status >= 500) throw new ApiError('NETWORK', FRIENDLY.NETWORK, res.status);
    throw new ApiError('INTERNAL_ERROR', FRIENDLY.INTERNAL_ERROR, res.status);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

function badResponse(): ApiError {
  return new ApiError('BAD_RESPONSE', FRIENDLY.BAD_RESPONSE, null);
}

/** Light shape check plus defaults, so a slightly off response never crashes the UI. */
function normaliseChat(raw: unknown): ChatResponse {
  const r = raw as Partial<ChatResponse> | null;
  const t = r?.turn;
  if (!r || typeof r.conversationId !== 'string' || !t || typeof t.message !== 'string') throw badResponse();
  const unknownProvider = { name: 'unknown', isMock: false };
  return {
    conversationId: r.conversationId,
    turn: {
      stage: t.stage ?? 'follow_up',
      message: t.message,
      followUpQuestion: t.followUpQuestion ?? null,
      quickReplies: t.quickReplies ?? [],
      recommendations: t.recommendations ?? [],
      safetyWarnings: t.safetyWarnings ?? [],
    },
    resources: r.resources ?? [],
    damageRegions: r.damageRegions ?? [],
    providers: {
      assessment: r.providers?.assessment ?? unknownProvider,
      segmentation: r.providers?.segmentation ?? unknownProvider,
    },
    imageAnalysed: r.imageAnalysed ?? false,
  };
}

export async function getHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const body = (await request('/health', { method: 'GET' }, SHORT_TIMEOUT_MS, signal)) as HealthResponse | null;
  if (!body || typeof body.isMock !== 'boolean') throw badResponse();
  return body;
}

export interface ChatPayload {
  message: string;
  conversationId?: string;
  /** Already processed (or a byte-for-byte sample photo). */
  image?: File;
  /** Town, district and state only: never coordinates. */
  location?: UserLocation;
}

export async function sendChat(payload: ChatPayload, signal?: AbortSignal): Promise<ChatResponse> {
  // Always multipart, even for text-only messages: one code path on the server.
  const form = new FormData();
  form.append('message', payload.message);
  if (payload.conversationId) form.append('conversationId', payload.conversationId);
  if (payload.location) form.append('location', JSON.stringify(payload.location));
  if (payload.image) form.append('image', payload.image, payload.image.name);
  const body = await request('/chat', { method: 'POST', body: form }, CHAT_TIMEOUT_MS, signal);
  return normaliseChat(body);
}

export async function postOutcome(conversationId: string, outcome: OutcomeValue, signal?: AbortSignal): Promise<void> {
  await request(
    '/outcomes',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, outcome }),
    },
    SHORT_TIMEOUT_MS,
    signal,
  );
}
