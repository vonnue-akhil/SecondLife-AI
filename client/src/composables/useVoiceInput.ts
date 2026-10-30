import { computed, onScopeDispose, ref } from 'vue';
import { ApiError } from '../lib/api';
import { AudioError, MAX_RECORD_SECONDS, canRecord, startRecording, type Recorder } from '../lib/audio';
import { transcribe } from '../lib/voice-api';
import { useComposer } from './useComposer';

export type VoiceState = 'idle' | 'starting' | 'recording' | 'transcribing';

const AUDIO_COPY: Record<AudioError['kind'], string> = {
  denied: 'Microphone access is blocked. Allow it in your browser settings to speak instead of typing.',
  'no-mic': 'No microphone was found on this device.',
  unsupported: 'Voice input isn’t supported in this browser. Please type instead.',
  empty: 'I didn’t catch that. Try again a little closer to the mic.',
  failed: 'That recording couldn’t be processed. Please try again.',
};

export function useVoiceInput() {
  const { draft } = useComposer();
  const state = ref<VoiceState>('idle');
  const elapsed = ref(0);
  const error = ref<string | null>(null);
  const supported = canRecord();

  let recorder: Recorder | null = null;
  let timer: ReturnType<typeof setInterval> | undefined;
  let abort: AbortController | null = null;
  let run = 0; // bumped by cancel/teardown so a late result is ignored

  const clearTimer = () => {
    clearInterval(timer);
    timer = undefined;
  };

  async function start() {
    if (state.value !== 'idle') return;
    error.value = null;
    const mine = ++run;
    state.value = 'starting';
    try {
      const r = await startRecording();
      if (mine !== run) return r.cancel();
      recorder = r;
    } catch (err) {
      if (mine !== run) return;
      state.value = 'idle';
      error.value = AUDIO_COPY[err instanceof AudioError ? err.kind : 'failed'];
      return;
    }
    elapsed.value = 0;
    state.value = 'recording';
    timer = setInterval(() => {
      elapsed.value += 1;
      if (elapsed.value >= MAX_RECORD_SECONDS) void stop();
    }, 1000);
  }

  async function stop() {
    if (state.value !== 'recording' || !recorder) return;
    const mine = run;
    const r = recorder;
    recorder = null;
    clearTimer();
    state.value = 'transcribing';
    abort = new AbortController();
    try {
      const text = (await transcribe(await r.stop(), abort.signal)).trim();
      if (mine !== run) return;
      if (!text) {
        error.value = AUDIO_COPY.empty;
      } else {
        draft.value = draft.value.trim() ? `${draft.value.replace(/\s+$/, '')} ${text}` : text;
      }
    } catch (err) {
      if (mine !== run) return;
      error.value = err instanceof ApiError ? err.message : AUDIO_COPY[err instanceof AudioError ? err.kind : 'failed'];
    } finally {
      if (mine === run) state.value = 'idle';
    }
  }

  function cancel() {
    run++;
    clearTimer();
    recorder?.cancel();
    recorder = null;
    abort?.abort();
    abort = null;
    state.value = 'idle';
    error.value = null;
  }

  onScopeDispose(cancel);

  return {
    supported,
    state,
    elapsed,
    error,
    busy: computed(() => state.value !== 'idle'),
    start,
    stop,
    cancel,
    clearError: () => (error.value = null),
  };
}
