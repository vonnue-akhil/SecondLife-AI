import { computed, markRaw, ref, shallowRef } from 'vue';
import type { ChatResponse, HealthResponse, OutcomeValue } from '../../../shared/schemas';
import { ApiError, getHealth, postOutcome, searchResources, sendChat } from '../lib/api';
import {
  CHECKING_BADGE,
  OFFLINE_BADGE,
  badgeFromHealth,
  badgeFromProviders,
  type ModeBadgeState,
} from '../lib/presentation';
import type { ReadyAttachment } from './useComposer';
import { useLocation } from './useLocation';

/** A photo as the client holds it: an object URL of exactly the bytes that were uploaded. */
export interface Photo {
  url: string;
  width: number;
  height: number;
}

/** A clip the user sent; its poster frame (if any) is the entry's `photo`. */
export interface Clip {
  url: string;
  durationMs: number;
}

export interface UserEntry {
  kind: 'user';
  id: string;
  text: string;
  /** The photo, or the poster frame of the clip. */
  photo: Photo | null;
  video: Clip | null;
  /** Kept until the message is delivered so Retry resends the identical bytes. */
  file: File | null;
  videoFile: File | null;
  status: 'sending' | 'sent' | 'failed';
  error: ApiError | null;
}

export interface AssistantEntry {
  kind: 'assistant';
  id: string;
  response: ChatResponse;
  /** The photo (or video poster frame) carried by the request this turn answers, used for the damage overlay. */
  photo: Photo | null;
  /** Web search for extra official links: only set on recommending turns, when the server supports it. */
  webSearch: 'searching' | 'done' | 'failed' | null;
}

export type Entry = UserEntry | AssistantEntry;

export interface OutcomeState {
  recorded: OutcomeValue | null;
  saving: OutcomeValue | null;
  error: string | null;
}

// ---------------------------------------------------------------------------
// Module-level state shared by every component (no store library needed).
// ---------------------------------------------------------------------------

const entries = ref<Entry[]>([]);
const conversationId = ref<string | null>(null);
const sending = ref(false);
const health = shallowRef<HealthResponse | null>(null);
const healthStatus = ref<'checking' | 'ok' | 'error'>('checking');
const outcome = ref<OutcomeState>({ recorded: null, saving: null, error: null });
const { location } = useLocation();

let inflight: AbortController | null = null;
let outcomeInflight: AbortController | null = null;
let searchInflight: AbortController | null = null;
let idCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

const hasConversation = computed(() => entries.value.length > 0);

const lastAssistant = computed<AssistantEntry | null>(() => {
  for (let i = entries.value.length - 1; i >= 0; i--) {
    const e = entries.value[i];
    if (e?.kind === 'assistant') return e;
  }
  return null;
});

/** The outcome control lives on the most recent recommending turn only. */
const latestRecommendationId = computed<string | null>(() => {
  for (let i = entries.value.length - 1; i >= 0; i--) {
    const e = entries.value[i];
    if (e?.kind === 'assistant' && e.response.turn.recommendations.length > 0) return e.id;
  }
  return null;
});

/** Mode badge: the latest reply's providers win; before that, what /health reported. */
const modeBadge = computed<ModeBadgeState>(() => {
  if (lastAssistant.value) return badgeFromProviders(lastAssistant.value.response.providers);
  if (health.value) return badgeFromHealth(health.value);
  return healthStatus.value === 'error' ? OFFLINE_BADGE : CHECKING_BADGE;
});

const supportsImages = computed(() => health.value?.supportsImages ?? true);
const supportsVideo = computed(() => health.value?.supportsVideo ?? false);
const speechToText = computed(() => health.value?.speechToText ?? false);

/** /health with a few quiet retries: in `npm run dev` the page can load before the API is up. */
async function loadHealth(attempt = 0): Promise<void> {
  try {
    health.value = await getHealth();
    healthStatus.value = 'ok';
  } catch {
    healthStatus.value = 'error';
    if (attempt < 3) setTimeout(() => void loadHealth(attempt + 1), 2000 * (attempt + 1));
  }
}

function findUser(id: string): UserEntry | undefined {
  const e = entries.value.find((x) => x.id === id);
  return e?.kind === 'user' ? e : undefined;
}

function resetOutcome() {
  outcomeInflight?.abort();
  outcomeInflight = null;
  outcome.value = { recorded: null, saving: null, error: null };
}

/** Appends web-found links after the curated ones. A newer search or a reset makes this one stale. */
async function searchWeb(entryId: string, id: string) {
  searchInflight?.abort();
  for (const e of entries.value) if (e.kind === 'assistant' && e.id !== entryId && e.webSearch === 'searching') e.webSearch = null;
  const controller = new AbortController();
  searchInflight = controller;
  const entry = () => {
    const e = entries.value.find((x) => x.id === entryId);
    return e?.kind === 'assistant' ? e : undefined;
  };
  try {
    const result = await searchResources(id, controller.signal);
    if (controller.signal.aborted) return;
    const target = entry();
    if (!target) return;
    if (result.resources.length > 0) {
      const have = new Set(target.response.resources.map((r) => r.id));
      target.response = markRaw({
        ...target.response,
        resources: [...target.response.resources, ...result.resources.filter((r) => !have.has(r.id))],
      });
    }
    target.webSearch = 'done';
  } catch {
    if (controller.signal.aborted) return;
    const target = entry();
    if (target) target.webSearch = 'failed';
  } finally {
    if (searchInflight === controller) searchInflight = null;
  }
}

async function dispatch(id: string) {
  const entry = findUser(id);
  if (!entry) return;

  const controller = new AbortController();
  inflight = controller;
  sending.value = true;
  entry.status = 'sending';
  entry.error = null;

  try {
    const response = await sendChat(
      {
        message: entry.text,
        conversationId: conversationId.value ?? undefined,
        image: entry.file ?? undefined,
        video: entry.videoFile ?? undefined,
        location: location.value ?? undefined,
      },
      controller.signal,
    );
    if (controller.signal.aborted) return;
    // An expired session is silently replaced by the server: adopt the new id.
    if (conversationId.value && conversationId.value !== response.conversationId) resetOutcome();
    conversationId.value = response.conversationId;
    entry.status = 'sent';
    entry.file = null;
    entry.videoFile = null;
    const searchable =
      health.value?.webSearch === true && response.turn.stage === 'recommending' && response.turn.recommendations.length > 0;
    const assistant: AssistantEntry = {
      kind: 'assistant',
      id: nextId('a'),
      response: markRaw(response),
      photo: entry.photo,
      webSearch: searchable ? 'searching' : null,
    };
    entries.value.push(assistant);
    if (searchable) void searchWeb(assistant.id, response.conversationId);
    if (healthStatus.value === 'error') healthStatus.value = 'ok';
  } catch (err) {
    if (controller.signal.aborted) return; // reset() discarded this request
    entry.status = 'failed';
    entry.error = markRaw(
      err instanceof ApiError ? err : new ApiError('NETWORK', 'Something went wrong. Please try again.', null),
    );
  } finally {
    if (inflight === controller) {
      inflight = null;
      sending.value = false;
    }
  }
}

/** Sends a new message. The attachment's object URL now belongs to the conversation. */
function send(text: string, image?: ReadyAttachment | null): boolean {
  const message = text.trim();
  if (sending.value || (!message && !image)) return false;
  const poster = image?.file && image.url ? { url: image.url, width: image.width, height: image.height } : null;
  const entry: UserEntry = {
    kind: 'user',
    id: nextId('u'),
    text: message,
    photo: poster,
    video: image?.video ? { url: image.video.url, durationMs: image.video.durationMs } : null,
    file: image?.file ?? null,
    videoFile: image?.video?.file ?? null,
    status: 'sending',
    error: null,
  };
  entries.value.push(entry);
  void dispatch(entry.id);
  return true;
}

/** Only the newest message can be retried; older failures were superseded. */
function canRetry(id: string): boolean {
  const last = entries.value[entries.value.length - 1];
  return last?.id === id && last.kind === 'user' && last.status === 'failed' && !!last.error?.retryable;
}

/** Resends a failed message with exactly the same text, image and video bytes. */
function retry(id: string) {
  if (sending.value || !canRetry(id)) return;
  void dispatch(id);
}

async function recordOutcome(value: OutcomeValue) {
  const id = conversationId.value;
  if (!id) return;

  outcomeInflight?.abort();
  const controller = new AbortController();
  outcomeInflight = controller;
  outcome.value = { ...outcome.value, saving: value, error: null };

  try {
    await postOutcome(id, value, controller.signal);
    if (controller.signal.aborted) return;
    outcome.value = { recorded: value, saving: null, error: null };
  } catch (err) {
    if (controller.signal.aborted) return;
    const message =
      err instanceof ApiError && err.code === 'NOT_FOUND'
        ? 'This conversation has expired, so we couldn’t save your choice. Start a new conversation to try again.'
        : err instanceof ApiError
          ? err.message
          : 'Couldn’t save that. Please try again.';
    outcome.value = { ...outcome.value, saving: null, error: message };
  } finally {
    if (outcomeInflight === controller) outcomeInflight = null;
  }
}

/** Clears the session client-side: cancels requests and frees photo object URLs. */
function reset() {
  inflight?.abort();
  inflight = null;
  searchInflight?.abort();
  searchInflight = null;
  resetOutcome();
  const urls = new Set(
    entries.value.flatMap((e) => (e.kind === 'user' ? [e.photo?.url, e.video?.url] : [e.photo?.url])).filter((u): u is string => !!u),
  );
  urls.forEach((u) => URL.revokeObjectURL(u));
  entries.value = [];
  conversationId.value = null;
  sending.value = false;
}

export function useConversation() {
  return {
    entries,
    conversationId,
    sending,
    health,
    healthStatus,
    outcome,
    hasConversation,
    lastAssistant,
    latestRecommendationId,
    modeBadge,
    supportsImages,
    supportsVideo,
    speechToText,
    loadHealth,
    send,
    canRetry,
    retry,
    recordOutcome,
    reset,
  };
}
