import { ZodError } from 'zod';
import { AssistantTurnSchema, DeviceObservationsSchema, type AssistantTurn } from '../../../../shared/schemas';
import { AppError } from '../../middleware/errors';
import { fallbackTurn, parseModelOutput } from '../../services/recommendation.service';
import { detectHazard } from '../../services/safety.service';
import type { AssessmentProvider } from '../types';
import { chatCompletion, responseFormat, type ChatMessage, type MuseHost } from './client';
import { conversationContext, OBSERVE_SYSTEM_PROMPT, RESPOND_SYSTEM_PROMPT } from './prompts';

// With segmentation (10 s), the worst case stays under the client's 70 s chat timeout.
const OBSERVE_TIMEOUT_MS = 18_000;
const RESPOND_TIMEOUT_MS = 25_000;
const REPAIR_TIMEOUT_MS = 15_000;

const OBSERVATIONS_FORMAT = responseFormat('device_observations', DeviceObservationsSchema);
const TURN_FORMAT = responseFormat('assistant_turn', AssistantTurnSchema);

/** Where validation failed, without the values (they can contain what the user wrote). */
const issuePaths = (err: ZodError) => err.issues.map((i) => i.path.join('.') || '(root)').join(', ');

/** Last resort after a failed repair: keep the reply's message if there is one, otherwise give up. */
function salvage(raw: string): AssistantTurn {
  try {
    const value: unknown = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1));
    const message = (value as { message?: unknown } | null)?.message;
    if (typeof message === 'string' && message.trim() !== '') return fallbackTurn(message);
  } catch {
    // not JSON
  }
  if (raw.trim() !== '' && !raw.trim().startsWith('{')) return fallbackTurn(raw);
  throw new AppError('PROVIDER_ERROR', 502, "The assistant's reply could not be read. Please try again.");
}

export function createMuseAssessmentProvider(host: MuseHost): AssessmentProvider {
  return {
    name: 'Muse Spark',
    isMock: false,
    supportsImages: true,

    async observeImage(image, userText) {
      const { content } = await chatCompletion(host, {
        messages: [
          { role: 'system', content: OBSERVE_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: userText ? `The user's note: ${userText}` : 'The user sent this photo without a note.' },
              { type: 'image_url', image_url: { url: `data:${image.mimeType};base64,${image.buffer.toString('base64')}` } },
            ],
          },
        ],
        format: OBSERVATIONS_FORMAT,
        timeoutMs: OBSERVE_TIMEOUT_MS,
      });
      const parsed = parseModelOutput(content, DeviceObservationsSchema);
      if (parsed instanceof ZodError) throw new Error(`invalid photo observations at ${issuePaths(parsed)}`);
      return parsed;
    },

    async respond(session) {
      const messages: ChatMessage[] = [
        { role: 'system', content: `${RESPOND_SYSTEM_PROMPT}\n\n${conversationContext(session, detectHazard(session))}` },
        ...session.messages.map((m) => ({ role: m.role, content: m.text })),
      ];
      const first = await chatCompletion(host, { messages, format: TURN_FORMAT, timeoutMs: RESPOND_TIMEOUT_MS });
      const parsed = parseModelOutput(first.content, AssistantTurnSchema);
      if (!(parsed instanceof ZodError)) return parsed;

      // One repair call: show the model its reply and the validation error, and ask for corrected JSON.
      console.warn(`[muse] invalid turn (finish_reason ${first.finishReason}) at ${issuePaths(parsed)}; asking for a repair`);
      try {
        const repair = await chatCompletion(host, {
          messages: [
            ...messages,
            { role: 'assistant', content: first.content },
            {
              role: 'user',
              content: `Your last reply did not match the response schema:\n${parsed.issues.map((i) => `- ${i.path.join('.') || '(root)'}: ${i.message}`).join('\n')}\nReply again with the corrected JSON object only.`,
            },
          ],
          format: TURN_FORMAT,
          timeoutMs: REPAIR_TIMEOUT_MS,
        });
        const repaired = parseModelOutput(repair.content, AssistantTurnSchema);
        if (!(repaired instanceof ZodError)) return repaired;
        console.warn(`[muse] repair still invalid at ${issuePaths(repaired)}`);
      } catch (err) {
        console.warn('[muse] repair call failed:', err instanceof Error ? err.message : err);
      }
      return salvage(first.content);
    },
  };
}
