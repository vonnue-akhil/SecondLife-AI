// Microphone recording for speech to text: capture with MediaRecorder, then decode and resample to the
// mono 16-bit 16 kHz WAV that Muse Voice Transcribe accepts. Audio never leaves the device until sent.

export const TARGET_RATE = 16_000;
export const MAX_RECORD_SECONDS = 60;

export class AudioError extends Error {
  constructor(readonly kind: 'denied' | 'no-mic' | 'unsupported' | 'empty' | 'failed', message: string) {
    super(message);
    this.name = 'AudioError';
  }
}

export function canRecord(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.isSecureContext &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined'
  );
}

/** Mono 16-bit PCM WAV with a 44-byte header. Pure, so it can run in Node tests. */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const dataBytes = samples.length * 2;
  const out = new Uint8Array(44 + dataBytes);
  const view = new DataView(out.buffer);
  const text = (at: number, s: string) => [...s].forEach((c, i) => view.setUint8(at + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + dataBytes, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, dataBytes, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return out;
}

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export interface Recorder {
  /** Finish and return a 16 kHz mono WAV. */
  stop(): Promise<Blob>;
  /** Discard everything and release the microphone. */
  cancel(): void;
}

export async function startRecording(): Promise<Recorder> {
  if (!canRecord()) throw new AudioError('unsupported', 'Voice input isn’t supported in this browser.');
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
  } catch (err) {
    const name = (err as DOMException).name;
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new AudioError('no-mic', 'No microphone was found.');
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new AudioError('denied', 'Microphone access is blocked.');
    throw new AudioError('failed', 'The microphone couldn’t be started.');
  }
  const release = () => stream.getTracks().forEach((t) => t.stop());

  let recorder: MediaRecorder;
  try {
    const mimeType = MIME_CANDIDATES.find((t) => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  } catch {
    release();
    throw new AudioError('unsupported', 'Voice input isn’t supported in this browser.');
  }
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size > 0 && chunks.push(e.data);
  recorder.start();

  const finished = () =>
    new Promise<void>((resolve) => {
      if (recorder.state === 'inactive') return resolve();
      recorder.onstop = () => resolve();
      recorder.stop();
    });

  return {
    async stop() {
      try {
        await finished();
      } finally {
        release();
      }
      return toWav(new Blob(chunks, { type: recorder.mimeType }));
    },
    cancel() {
      recorder.ondataavailable = null;
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    },
  };
}

async function toWav(recording: Blob): Promise<Blob> {
  if (recording.size === 0) throw new AudioError('empty', 'Nothing was recorded.');
  const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctx();
  try {
    const bytes = await recording.arrayBuffer();
    // Callback form: older Safari has no promise-returning decodeAudioData.
    const decoded = await new Promise<AudioBuffer>((resolve, reject) => ctx.decodeAudioData(bytes, resolve, reject));
    const length = Math.ceil(decoded.duration * TARGET_RATE);
    if (length < TARGET_RATE / 10) throw new AudioError('empty', 'Nothing was recorded.');
    const offline = new OfflineAudioContext(1, length, TARGET_RATE); // mixes down to mono while resampling
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return new Blob([encodeWav(rendered.getChannelData(0), TARGET_RATE) as BlobPart], { type: 'audio/wav' });
  } catch (err) {
    if (err instanceof AudioError) throw err;
    throw new AudioError('failed', 'That recording couldn’t be processed.');
  } finally {
    void ctx.close().catch(() => {});
  }
}
