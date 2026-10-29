import { computed, ref, shallowRef } from 'vue';
import { ImageError, prepareImage, readDimensions } from '../lib/image';
import { SAMPLE_PHOTOS, type SamplePhoto } from '../lib/samples';

/** A photo ready to send: the exact bytes to upload plus an object URL of those same bytes. */
export interface ReadyAttachment {
  file: File;
  url: string;
  width: number;
  height: number;
  /** Set when this is one of the bundled sample photos (uploaded unchanged). */
  sampleId: string | null;
}

type AttachmentState =
  | { status: 'empty' }
  | { status: 'processing'; sampleId: string | null }
  | ({ status: 'ready' } & ReadyAttachment);

// Module-level: the draft survives the landing → conversation switch, and drag-and-drop,
// paste and the sample chips all feed the same composer.
const draft = ref('');
const state = shallowRef<AttachmentState>({ status: 'empty' });
const error = ref<string | null>(null);
let generation = 0;

function revokeCurrent() {
  if (state.value.status === 'ready') URL.revokeObjectURL(state.value.url);
}

/** Runs `work` unless a newer attach/remove supersedes it; returns false if superseded. */
async function load(sampleId: string | null, work: () => Promise<ReadyAttachment>): Promise<boolean> {
  const token = ++generation;
  error.value = null;
  revokeCurrent();
  state.value = { status: 'processing', sampleId };
  try {
    const ready = await work();
    if (token !== generation) {
      URL.revokeObjectURL(ready.url);
      return false;
    }
    state.value = { status: 'ready', ...ready };
    return true;
  } catch (err) {
    if (token !== generation) return false;
    state.value = { status: 'empty' };
    error.value = err instanceof ImageError ? err.message : 'Something went wrong preparing that photo. Please try another one.';
    return false;
  }
}

function attachFile(file: File): Promise<boolean> {
  return load(null, async () => {
    const prepared = await prepareImage(file);
    return { ...prepared, url: URL.createObjectURL(prepared.file), sampleId: null };
  });
}

async function attachSample(sample: SamplePhoto): Promise<boolean> {
  const ok = await load(sample.id, async () => {
    const res = await fetch(sample.src);
    const blob = res.ok ? await res.blob() : null;
    // A dev server answers unknown paths with index.html, so check the type too.
    if (!blob || !blob.type.startsWith('image/')) {
      throw new ImageError('That sample photo isn’t available right now. Please try another one.');
    }
    // Byte-for-byte copy of the bundled file: no resize, no re-encode.
    const file = new File([blob], `${sample.id}.jpg`, { type: 'image/jpeg' });
    const { width, height } = await readDimensions(file);
    return { file, url: URL.createObjectURL(file), width, height, sampleId: sample.id };
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
