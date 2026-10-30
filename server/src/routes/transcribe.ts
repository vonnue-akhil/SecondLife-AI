import { Router } from 'express';
import multer from 'multer';
import type { TranscribeResponse } from '../../../shared/schemas';
import { MAX_AUDIO_SECONDS } from '../config';
import { AppError } from '../middleware/errors';
import { speechToText } from '../providers';

export const transcribeRouter = Router();

// 60 s of 24 kHz mono 16-bit is about 2.9 MB. Audio stays in memory and is never written or logged.
const uploadAudio = multer({ storage: multer.memoryStorage(), limits: { fileSize: 3 * 1024 * 1024, files: 1 } });

const UNSUPPORTED = 'That recording couldn’t be read. Please try again.';
const TOO_LONG = 'That recording is too long. Please keep it under a minute.';

/** Walks the RIFF chunks and returns the clip length in seconds, or throws UNSUPPORTED_AUDIO / AUDIO_TOO_LARGE. */
function wavSeconds(buf: Buffer): number {
  const bad = () => new AppError('UNSUPPORTED_AUDIO', 400, UNSUPPORTED);
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') throw bad();
  let rate = 0;
  let dataBytes = -1;
  let ok = false;
  for (let pos = 12; pos + 8 <= buf.length; ) {
    const id = buf.toString('ascii', pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    if (id === 'fmt ' && pos + 8 + 16 <= buf.length) {
      rate = buf.readUInt32LE(pos + 12);
      ok = buf.readUInt16LE(pos + 8) === 1 && buf.readUInt16LE(pos + 10) === 1 && buf.readUInt16LE(pos + 22) === 16;
    } else if (id === 'data') {
      dataBytes = Math.min(size, buf.length - (pos + 8)); // streamed WAVs may claim 0 or 0xFFFFFFFF
      break;
    }
    pos += 8 + size + (size % 2);
  }
  if (!ok || (rate !== 16000 && rate !== 24000) || dataBytes <= 0) throw bad();
  const seconds = dataBytes / (rate * 2);
  if (seconds > MAX_AUDIO_SECONDS + 1) throw new AppError('AUDIO_TOO_LARGE', 413, TOO_LONG);
  return seconds;
}

transcribeRouter.post('/', uploadAudio.single('audio'), async (req, res) => {
  if (!speechToText) throw new AppError('NOT_FOUND', 404, 'Speech to text isn’t available right now.');
  if (!req.file) throw new AppError('INVALID_INPUT', 400, 'Send the recording as an "audio" file.');
  const seconds = wavSeconds(req.file.buffer);

  const started = Date.now();
  let text: string;
  try {
    text = await speechToText.transcribe(req.file.buffer, AbortSignal.timeout(20_000));
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new AppError('PROVIDER_TIMEOUT', 504, 'Transcribing took too long. Please try again.');
    }
    console.error('[transcribe]', err instanceof Error ? err.message : String(err));
    throw new AppError('PROVIDER_ERROR', 502, 'Speech to text is having trouble right now. Please try again in a moment.');
  }
  console.log(`[transcribe] ${seconds.toFixed(1)}s → ${text.length} chars, ${Date.now() - started} ms`);
  const body: TranscribeResponse = { text };
  res.json(body);
});
