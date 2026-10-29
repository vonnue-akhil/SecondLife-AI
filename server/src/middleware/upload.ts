import { createHash } from 'node:crypto';
import multer from 'multer';
import { env } from '../config';
import type { PreparedImage } from '../providers/types';
import { AppError } from './errors';

// Memory storage only: images are never written to disk.
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.MAX_UPLOAD_MB * 1024 * 1024, files: 1, fields: 10, fieldSize: 64 * 1024 },
}).single('image');

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
