import { createHash } from 'node:crypto';
import multer from 'multer';
import { readMp4Info, stripMp4Metadata } from '../../../shared/mp4';
import { env, MAX_VIDEO_SECONDS } from '../config';
import type { PreparedImage, PreparedVideo } from '../providers/types';
import { AppError } from './errors';

const IMAGE_LIMIT = env.MAX_UPLOAD_MB * 1024 * 1024;
const VIDEO_LIMIT = env.MAX_VIDEO_MB * 1024 * 1024;

// Memory storage only: uploads are never written to disk. Multer enforces the larger limit;
// prepareImage and prepareVideo enforce each field's own.
export const uploadMedia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: Math.max(IMAGE_LIMIT, VIDEO_LIMIT), files: 2, fields: 10, fieldSize: 64 * 1024 },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

type Mime = PreparedImage['mimeType'];
const UNSUPPORTED = () => new AppError('UNSUPPORTED_IMAGE', 415, 'Please upload a JPEG, PNG or WebP photo.');

function detectMime(b: Buffer): Mime | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}

function jpegSize(b: Buffer): { width: number; height: number } | null {
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) { i++; continue; }
    const marker = b[i + 1]!;
    if (marker === 0xff) { i++; continue; } // fill byte
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; } // no length field
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
    i += 2 + b.readUInt16BE(i + 2);
  }
  return null;
}

function pngSize(b: Buffer): { width: number; height: number } | null {
  if (b.length < 24 || b.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
}

function webpSize(b: Buffer): { width: number; height: number } | null {
  const chunk = b.toString('ascii', 12, 16);
  const d = 20; // chunk data starts after the 8-byte chunk header
  if (chunk === 'VP8 ' && b.length >= d + 10 && b[d + 3] === 0x9d && b[d + 4] === 0x01 && b[d + 5] === 0x2a) {
    return { width: b.readUInt16LE(d + 6) & 0x3fff, height: b.readUInt16LE(d + 8) & 0x3fff };
  }
  if (chunk === 'VP8L' && b.length >= d + 5 && b[d] === 0x2f) {
    const b1 = b[d + 1]!, b2 = b[d + 2]!, b3 = b[d + 3]!, b4 = b[d + 4]!;
    return { width: 1 + (b1 | ((b2 & 0x3f) << 8)), height: 1 + ((b2 >> 6) | (b3 << 2) | ((b4 & 0x0f) << 10)) };
  }
  if (chunk === 'VP8X' && b.length >= d + 10) {
    return { width: 1 + b.readUIntLE(d + 4, 3), height: 1 + b.readUIntLE(d + 7, 3) };
  }
  return null;
}

/** Checks the declared type and the file signature, reads the size from the header, and hashes the bytes. */
export function prepareImage(file: Express.Multer.File): PreparedImage {
  const buffer = file.buffer;
  if (buffer.length > IMAGE_LIMIT) throw new AppError('IMAGE_TOO_LARGE', 413, `That photo is too large. Please use one under ${env.MAX_UPLOAD_MB} MB.`);
  const mime = detectMime(buffer);
  if (!mime || file.mimetype !== mime) throw UNSUPPORTED();
  const size = mime === 'image/jpeg' ? jpegSize(buffer) : mime === 'image/png' ? pngSize(buffer) : webpSize(buffer);
  if (!size || size.width < 1 || size.height < 1) throw UNSUPPORTED();
  return {
    buffer,
    mimeType: mime,
    width: size.width,
    height: size.height,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}

const DURATION_SLACK_MS = 500;
/** ISO-BMFF brands that are photos or audio, not clips. */
const NON_VIDEO_BRANDS = new Set(['heic', 'heix', 'hevc', 'mif1', 'msf1', 'avif', 'avis', 'M4A ', 'M4B ', 'crx ', 'jp2 ']);
const UNSUPPORTED_VIDEO = (message = 'Please upload an MP4 or MOV video clip.') => new AppError('UNSUPPORTED_VIDEO', 415, message);

/** Checks the declared type against the ISO-BMFF header, limits the length, strips metadata and hashes the bytes. */
export function prepareVideo(file: Express.Multer.File): PreparedVideo {
  if (file.buffer.length > VIDEO_LIMIT) {
    throw new AppError('VIDEO_TOO_LARGE', 413, `That video is too large. Please use a clip under ${env.MAX_VIDEO_MB} MB.`);
  }
  const info = readMp4Info(file.buffer);
  const isQuickTime = info?.majorBrand === 'qt  ';
  const declared = file.mimetype === 'video/mp4' ? 'video/mp4' : file.mimetype === 'video/quicktime' ? 'video/quicktime' : null;
  // Phones sometimes label MOV files video/mp4 and the reverse, so only the header decides which one it is.
  if (!info || !declared || NON_VIDEO_BRANDS.has(info.majorBrand)) throw UNSUPPORTED_VIDEO();
  if (info.durationMs > (MAX_VIDEO_SECONDS * 1000) + DURATION_SLACK_MS) {
    throw UNSUPPORTED_VIDEO(`That clip is ${Math.round(info.durationMs / 1000)} seconds long. Please use one of ${MAX_VIDEO_SECONDS} seconds or less.`);
  }
  if (info.durationMs <= 0) throw UNSUPPORTED_VIDEO('We couldn’t read that clip. Please record it again.');
  const buffer = Buffer.from(stripMp4Metadata(file.buffer));
  return {
    buffer,
    mimeType: isQuickTime ? 'video/quicktime' : 'video/mp4',
    durationMs: info.durationMs,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
}
