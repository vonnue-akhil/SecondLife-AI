// Client-side photo preparation (plan §9): honour EXIF orientation, cap the longest side
// at 1600 px and re-encode as JPEG. The fresh JPEG carries no EXIF metadata, so GPS
// location never leaves the device.

export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif';

const MAX_SIDE_PX = 1600;
const JPEG_QUALITY = 0.8;
/** Refuse absurdly large originals before trying to decode them. */
const MAX_INPUT_MB = 30;

export class ImageError extends Error {}

export interface PreparedImage {
  file: File;
  width: number;
  height: number;
}

export function looksLikeHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function looksLikeImage(file: File): boolean {
  return file.type.startsWith('image/') || /\.(jpe?g|png|webp|hei[cf]|gif|bmp|avif)$/i.test(file.name);
}

interface Decoded {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

/** Fallback for browsers without createImageBitmap options; <img> honours EXIF orientation by default. */
function decodeWithImageElement(blob: Blob): Promise<Decoded> {
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth,
        height: img.naturalHeight,
        release: () => URL.revokeObjectURL(url),
      });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

async function decode(blob: Blob): Promise<Decoded> {
  try {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch {
    return decodeWithImageElement(blob);
  }
}

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!looksLikeImage(file)) {
    throw new ImageError('That file isn’t a photo. Please attach a JPEG, PNG, WebP or HEIC image.');
  }
  if (file.size > MAX_INPUT_MB * 1024 * 1024) {
    throw new ImageError(`That photo is very large. Please choose one under ${MAX_INPUT_MB} MB.`);
  }

  let image: Decoded;
  try {
    image = await decode(file);
  } catch {
    throw new ImageError(
      looksLikeHeic(file)
        ? 'Your browser can’t open HEIC photos. Please attach a JPEG instead, or take a screenshot of the photo and attach that.'
        : 'We couldn’t open that photo. Please try a different JPEG, PNG or WebP image.',
    );
  }

  try {
    const scale = Math.min(1, MAX_SIDE_PX / Math.max(image.width, image.height));
    const width = Math.max(1, Math.round(image.width * scale));
    const height = Math.max(1, Math.round(image.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new ImageError('Your browser couldn’t prepare that photo. Please try another one.');
    // JPEG has no alpha: paint transparent PNG/WebP areas white rather than black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(image.source, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob) throw new ImageError('Your browser couldn’t prepare that photo. Please try another one.');

    return { file: new File([blob], 'photo.jpg', { type: 'image/jpeg', lastModified: Date.now() }), width, height };
  } finally {
    image.release();
  }
}

/** Reads pixel dimensions without touching the bytes (used for sample photos, uploaded unchanged). */
export async function readDimensions(blob: Blob): Promise<{ width: number; height: number }> {
  const image = await decode(blob);
  image.release();
  return { width: image.width, height: image.height };
}

/** First image-like file in a drag or paste payload, if any. */
export function firstImageFile(list: FileList | DataTransferItemList | null | undefined): File | null {
  if (!list) return null;
  for (const entry of Array.from(list as ArrayLike<File | DataTransferItem>)) {
    const file = entry instanceof File ? entry : entry.kind === 'file' ? entry.getAsFile() : null;
    if (file && looksLikeImage(file)) return file;
  }
  return null;
}
