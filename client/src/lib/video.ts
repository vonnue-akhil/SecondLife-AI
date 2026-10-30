// Client-side clip preparation: check the type, size and length, strip location metadata, and
// take a poster frame from the middle of the clip for the damage outlines.
import { readMp4Info, stripMp4Metadata } from '../../../shared/mp4';
import { ImageError, prepareImage } from './image';

export const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/quicktime,.mov,.mp4';

/** Match the server's defaults (MAX_VIDEO_MB, MAX_VIDEO_SECONDS). */
const MAX_VIDEO_MB = 20;
const MAX_VIDEO_SECONDS = 30;
const DURATION_SLACK_MS = 500;
const POSTER_TIMEOUT_MS = 8000;

export class VideoError extends Error {}

export interface PreparedVideo {
  file: File;
  url: string;
  durationMs: number;
  /** A frame from the middle of the clip, or null when the browser can't decode this clip. */
  poster: { file: File; url: string; width: number; height: number } | null;
}

export function looksLikeVideo(file: File): boolean {
  return file.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv|avi|3gp)$/i.test(file.name);
}

/** Seeks to the middle of the clip and returns that frame as a prepared JPEG, or null if it can't be decoded. */
function posterFrame(url: string, durationMs: number): Promise<File | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    let done = false;
    const finish = (file: File | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(file);
    };
    const timer = setTimeout(() => finish(null), POSTER_TIMEOUT_MS);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.onerror = () => finish(null);
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(durationMs / 2000, Math.max(0, (video.duration || durationMs / 1000) - 0.1));
    };
    video.onseeked = () => {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) return finish(null);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return finish(null);
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob((blob) => finish(blob ? new File([blob], 'frame.jpg', { type: 'image/jpeg' }) : null), 'image/jpeg', 0.92);
    };
    video.src = url;
  });
}

export async function prepareVideo(file: File): Promise<PreparedVideo> {
  if (!looksLikeVideo(file)) throw new VideoError('That file isn’t a video. Please attach an MP4 or MOV clip.');
  if (file.size > MAX_VIDEO_MB * 1024 * 1024) {
    throw new VideoError(`That clip is too large. Please choose one under ${MAX_VIDEO_MB} MB, or record a shorter one.`);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const info = readMp4Info(bytes);
  if (!info) {
    throw new VideoError('We can only use MP4 or MOV clips, like the ones your phone camera records. Please try another clip.');
  }
  if (info.durationMs > MAX_VIDEO_SECONDS * 1000 + DURATION_SLACK_MS) {
    throw new VideoError(`That clip is ${Math.round(info.durationMs / 1000)} seconds long. Please use one of ${MAX_VIDEO_SECONDS} seconds or less.`);
  }

  const mime = info.majorBrand === 'qt  ' ? 'video/quicktime' : 'video/mp4';
  const stripped = new File([stripMp4Metadata(bytes) as BlobPart], mime === 'video/quicktime' ? 'clip.mov' : 'clip.mp4', { type: mime });
  const url = URL.createObjectURL(stripped);

  let poster: PreparedVideo['poster'] = null;
  const frame = await posterFrame(url, info.durationMs);
  if (frame) {
    try {
      const prepared = await prepareImage(frame);
      poster = { file: prepared.file, url: URL.createObjectURL(prepared.file), width: prepared.width, height: prepared.height };
    } catch (err) {
      if (!(err instanceof ImageError)) throw err; // no poster: the clip is still sent
    }
  }
  return { file: stripped, url, durationMs: info.durationMs, poster };
}

/** First video-like file in a drag or paste payload, if any. */
export function firstVideoFile(list: FileList | DataTransferItemList | null | undefined): File | null {
  if (!list) return null;
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null;
    if (file && looksLikeVideo(file)) return file;
  }
  return null;
}

export function formatDuration(ms: number): string {
  const total = Math.max(1, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}
