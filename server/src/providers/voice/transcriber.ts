// Muse Voice Transcribe on the Meta Model API (https://dev.meta.ai/docs/api-reference/voice/transcribe.md).
// One push-to-talk turn per request: multipart with a JSON `request` part and the WAV as `audio`.
import { env } from '../../config';
import type { SpeechToText } from '../types';

/** Biases recognition toward words people say about devices (https://dev.meta.ai/docs/api-reference/voice/schemas.md). */
const KEYWORDS = [
  'Redmi', 'Xiaomi', 'Samsung Galaxy', 'iPhone', 'OnePlus', 'Realme', 'Vivo', 'Oppo', 'Poco',
  'MacBook', 'ThinkPad', 'swollen battery', 'e-waste',
];

export function createMuseVoiceTranscriber(): SpeechToText {
  const url = `${env.META_API_BASE_URL.replace(/\/+$/, '')}/asr/transcribe`;
  return {
    name: 'Muse Voice Transcribe',
    async transcribe(wav, signal) {
      const form = new FormData();
      form.append(
        'request',
        new Blob(
          [JSON.stringify({ model: env.ASR_MODEL_ID, audioEncoding: 'WAV', mode: 'PUSH_TO_TALK', languageBias: ['English', 'Hindi'], keywords: KEYWORDS })],
          { type: 'application/json' },
        ),
      );
      form.append('audio', new Blob([new Uint8Array(wav)], { type: 'audio/wav' }), 'speech.wav');

      const res = await fetch(`${url}?sessionId=${crypto.randomUUID()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.MODEL_API_KEY}` },
        body: form,
        signal,
      });
      if (!res.ok) {
        const detail = (await res.text().catch(() => '')).slice(0, 300);
        throw new Error(`Muse Voice Transcribe returned HTTP ${res.status}: ${detail}`);
      }
      const body = (await res.json()) as { transcript?: unknown };
      if (typeof body.transcript !== 'string') throw new Error('Muse Voice Transcribe returned no transcript');
      return body.transcript.trim();
    },
  };
}
