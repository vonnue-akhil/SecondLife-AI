import { Router } from 'express';
import { ChatFieldsSchema } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';
import { prepareImage, uploadImage } from '../middleware/upload';
import { runChatTurn } from '../services/conversation.service';

export const chatRouter = Router();

chatRouter.post('/', uploadImage, async (req, res) => {
  const fields = ChatFieldsSchema.safeParse(req.body ?? {});
  if (!fields.success) throw new AppError('INVALID_INPUT', 400, 'Your message was not understood. Messages can be up to 2000 characters.');
  const { message, conversationId } = fields.data;
  if (!message && !req.file) throw new AppError('INVALID_INPUT', 400, 'Type a message or attach a photo to continue.');

  const image = req.file ? prepareImage(req.file) : null;
  res.json(await runChatTurn({ message, conversationId, image }));
});
