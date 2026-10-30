import type { TranscribeResponse } from '../../../shared/schemas';
import { ApiError, request } from './api';

const TRANSCRIBE_TIMEOUT_MS = 30_000;

export async function transcribe(wav: Blob, signal?: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('audio', wav, 'speech.wav');
  const body = (await request('/transcribe', { method: 'POST', body: form }, TRANSCRIBE_TIMEOUT_MS, signal)) as Partial<TranscribeResponse> | null;
  if (typeof body?.text !== 'string') throw new ApiError('BAD_RESPONSE', 'We got a reply we couldn’t read. Please try again.', null);
  return body.text;
}
