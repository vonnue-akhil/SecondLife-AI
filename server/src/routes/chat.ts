import { Router } from 'express';
import { ChatFieldsSchema } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { prepareImage, prepareVideo, uploadMedia } from '../middleware/upload';
import { assessmentProvider } from '../providers';
import { runChatTurn } from '../services/conversation.service';

export const chatRouter = Router();

chatRouter.post('/', uploadMedia, async (req, res) => {
  const fields = ChatFieldsSchema.safeParse(req.body ?? {});
  if (!fields.success) throw new AppError('INVALID_INPUT', 400, 'Your message was not understood. Messages can be up to 2000 characters.');
  const { message, conversationId, location } = fields.data;
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const imageFile = files?.image?.[0];
  const videoFile = files?.video?.[0];
  if (!message && !imageFile && !videoFile) throw new AppError('INVALID_INPUT', 400, 'Type a message or attach a photo to continue.');
  if (videoFile && !assessmentProvider.supportsVideo) throw new AppError('UNSUPPORTED_VIDEO', 400, 'Video isn’t available right now. Please send a photo instead.');

  // With a video, the image is the poster frame the browser took from it.
  const video = videoFile ? prepareVideo(videoFile) : null;
  const image = imageFile ? prepareImage(imageFile) : null;
  res.json(await runChatTurn({ message, conversationId, image, video, location: location ?? null }));
});
