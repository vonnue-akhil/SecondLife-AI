import type { ErrorRequestHandler, RequestHandler } from 'express';
import multer from 'multer';
import type { ApiErrorBody, ApiErrorCode } from '../../../shared/schemas';
import { env } from '../config';

/** Throw this from routes and services; the message must be safe to show to users. */
export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

function send(res: Parameters<ErrorRequestHandler>[2], status: number, code: ApiErrorCode, message: string) {
  const body: ApiErrorBody = { error: { code, message } };
  res.status(status).json(body);
}

/** JSON 404 for unknown /api routes, so they never fall through to the SPA page. */
export const apiNotFound: RequestHandler = (_req, res) => {
  send(res, 404, 'NOT_FOUND', 'That API route does not exist.');
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) return;

  if (err instanceof AppError) return send(res, err.status, err.code, err.message);

  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      if (err.field === 'video') return send(res, 413, 'VIDEO_TOO_LARGE', `That video is too large. Please use a clip under ${env.MAX_VIDEO_MB} MB.`);
      if (err.field === 'audio') return send(res, 413, 'AUDIO_TOO_LARGE', 'That recording is too long. Please keep it under a minute.');
      return send(res, 413, 'IMAGE_TOO_LARGE', `That photo is too large. Please use one under ${env.MAX_UPLOAD_MB} MB.`);
    }
    return send(res, 400, 'INVALID_INPUT', 'The upload was not understood. Send at most one photo ("image") and one video ("video").');
  }

  // body-parser errors
  const type = (err as { type?: string } | null)?.type;
  if (type === 'entity.parse.failed') return send(res, 400, 'INVALID_INPUT', 'The request body is not valid JSON.');
  if (type === 'entity.too.large') return send(res, 413, 'INVALID_INPUT', 'The request body is too large.');

  // Log the error itself, never request bodies or image data.
  console.error('[error]', err instanceof Error ? (err.stack ?? err.message) : String(err));
  send(res, 500, 'INTERNAL_ERROR', 'Something went wrong on our side. Please try again.');
};
