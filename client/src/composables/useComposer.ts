import { computed, ref, shallowRef } from 'vue';
import { ImageError, prepareImage, readDimensions } from '../lib/image';
import { prepareVideo, VideoError, looksLikeVideo } from '../lib/video';
import { SAMPLE_PHOTOS, type SamplePhoto } from '../lib/samples';

/**
 * A photo or video clip ready to send: the exact bytes to upload plus object URLs of those same bytes.
 * For a clip, `file` and `url` are its poster frame (null when the browser couldn't decode one).
 */
export interface ReadyAttachment {
  file: File | null;
  url: string | null;
  width: number;
  height: number;
  video: { file: File; url: string; durationMs: number } | null;
  /** Set when this is one of the bundled sample photos (uploaded unchanged). */
  sampleId: string | null;
}

type AttachmentState =
  | { status: 'empty' }
  | { status: 'processing'; sampleId: string | null; isVideo: boolean }
  | ({ status: 'ready' } & ReadyAttachment);

// Module-level: the draft survives the landing → conversation switch, and drag-and-drop,
// paste and the sample chips all feed the same composer.
const draft = ref('');
const state = shallowRef<AttachmentState>({ status: 'empty' });
const error = ref<string | null>(null);
let generation = 0;

function revoke(a: ReadyAttachment) {
  if (a.url) URL.revokeObjectURL(a.url);
  if (a.video) URL.revokeObjectURL(a.video.url);
}

function revokeCurrent() {
  if (state.value.status === 'ready') revoke(state.value);
}

/** Runs `work` unless a newer attach/remove supersedes it; returns false if superseded. */
async function load(sampleId: string | null, isVideo: boolean, work: () => Promise<ReadyAttachment>): Promise<boolean> {
  const token = ++generation;
  error.value = null;
  revokeCurrent();
  state.value = { status: 'processing', sampleId, isVideo };
  try {
    const ready = await work();
    if (token !== generation) {
      revoke(ready);
      return false;
    }
    state.value = { status: 'ready', ...ready };
    return true;
  } catch (err) {
    if (token !== generation) return false;
    state.value = { status: 'empty' };
    error.value =
      err instanceof ImageError || err instanceof VideoError
        ? err.message
        : `Something went wrong preparing that ${isVideo ? 'clip' : 'photo'}. Please try another one.`;
    return false;
  }
}

/** A photo or, when videos are supported, a clip. Anything else gets a clear message from the image path. */
function attachFile(file: File, allowVideo = false): Promise<boolean> {
  if (allowVideo && looksLikeVideo(file)) {
    return load(null, true, async () => {
      const prepared = await prepareVideo(file);
      const { poster } = prepared;
      return {
        file: poster?.file ?? null,
        url: poster?.url ?? null,
        width: poster?.width ?? 0,
        height: poster?.height ?? 0,
        video: { file: prepared.file, url: prepared.url, durationMs: prepared.durationMs },
        sampleId: null,
      };
    });
  }
  return load(null, false, async () => {
    const prepared = await prepareImage(file);
    return { ...prepared, url: URL.createObjectURL(prepared.file), video: null, sampleId: null };
  });
}

async function attachSample(sample: SamplePhoto): Promise<boolean> {
  const ok = await load(sample.id, false, async () => {
    const res = await fetch(sample.src);
    const blob = res.ok ? await res.blob() : null;
    // A dev server answers unknown paths with index.html, so check the type too.
    if (!blob || !blob.type.startsWith('image/')) {
      throw new ImageError('That sample photo isn’t available right now. Please try another one.');
    }
    // Byte-for-byte copy of the bundled file: no resize, no re-encode.
    const file = new File([blob], `${sample.id}.jpg`, { type: 'image/jpeg' });
    const { width, height } = await readDimensions(file);
    return { file, url: URL.createObjectURL(file), width, height, video: null, sampleId: sample.id };
  });
  // Prefill the matching question, without overwriting anything the user typed themselves.
  const typed = draft.value.trim();
  if (ok && (!typed || SAMPLE_PHOTOS.some((s) => s.prompt === typed))) draft.value = sample.prompt;
  return ok;
}

function removeAttachment() {
  generation++;
  revokeCurrent();
  state.value = { status: 'empty' };
  error.value = null;
}

/** Hands the ready attachment to the caller, who now owns its object URL. */
function takeAttachment(): ReadyAttachment | null {
  const current = state.value;
  if (current.status !== 'ready') return null;
  generation++;
  state.value = { status: 'empty' };
  error.value = null;
  const { status: _status, ...ready } = current;
  return ready;
}

function clear() {
  removeAttachment();
  draft.value = '';
}

export function useComposer() {
  return {
    draft,
    attachment: computed(() => state.value),
    attachError: computed(() => error.value),
    isProcessing: computed(() => state.value.status === 'processing'),
    hasAttachment: computed(() => state.value.status === 'ready'),
    attachFile,
    attachSample,
    removeAttachment,
    takeAttachment,
    clearError: () => (error.value = null),
    clear,
  };
}
