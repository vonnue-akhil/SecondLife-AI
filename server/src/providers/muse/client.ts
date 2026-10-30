// Minimal client for the OpenAI-compatible Chat Completions endpoint that serves Muse Spark
// (https://dev.meta.ai/docs/protocols/chat-completions.md). Plain fetch, no SDK.
import { z } from 'zod';
import { env } from '../../config';
import { AppError } from '../../middleware/errors';

export type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }
  | { type: 'video_url'; video_url: { url: string } };

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
}

export interface ResponseFormat {
  name: string;
  schema: Record<string, unknown>;
}

export interface MuseHost {
  label: string; // for logs only
  baseUrl: string;
  apiKey: string;
  model: string;
  reasoningEffort?: 'minimal' | 'low' | 'medium' | 'high';
}

/** The configured host, or null when its API key is missing. */
export function museHost(): MuseHost | null {
  if (env.MUSE_HOST === 'baseten') {
    if (!env.BASETEN_API_KEY) return null;
    return { label: 'Baseten', baseUrl: env.BASETEN_BASE_URL, apiKey: env.BASETEN_API_KEY, model: env.BASETEN_MODEL_ID };
  }
  if (!env.MODEL_API_KEY) return null;
  // Muse Spark always reasons; "low" keeps a chat turn quick (https://dev.meta.ai/docs/reasoning.md).
  return { label: 'Meta Model API', baseUrl: env.META_API_BASE_URL, apiKey: env.MODEL_API_KEY, model: env.META_MODEL_ID, reasoningEffort: 'low' };
}

/**
 * JSON Schema for structured output, generated from a shared Zod schema. Drops the keywords that are
 * only annotations (`$schema`, `default`) and the safe-integer bounds Zod adds to `.int()`.
 */
export function responseFormat(name: string, schema: z.ZodType): ResponseFormat {
  const clean = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(clean);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === '$schema' || key === 'default') continue;
      if ((key === 'maximum' || key === 'minimum') && Math.abs(value as number) === Number.MAX_SAFE_INTEGER) continue;
      out[key] = clean(value);
    }
    return out;
  };
  return { name, schema: clean(z.toJSONSchema(schema, { io: 'output' })) as Record<string, unknown> };
}

interface ChatCompletionBody {
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
}

/** One structured-output chat completion. Returns the raw message text for the caller to validate. */
export async function chatCompletion(
  host: MuseHost,
  request: { messages: ChatMessage[]; format: ResponseFormat; timeoutMs: number },
): Promise<{ content: string; finishReason: string }> {
  const url = `${host.baseUrl.replace(/\/+$/, '')}/chat/completions`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${host.apiKey}` },
      body: JSON.stringify({
        model: host.model,
        messages: request.messages,
        reasoning_effort: host.reasoningEffort,
        response_format: {
          type: 'json_schema',
          json_schema: { name: request.format.name, strict: true, schema: request.format.schema },
        },
      }),
      signal: AbortSignal.timeout(request.timeoutMs),
    });
    if (!res.ok) {
      // The error body describes the request problem; it never echoes the image or video back.
      const detail = (await res.text().catch(() => '')).slice(0, 500);
      throw new Error(`${host.label} returned HTTP ${res.status}: ${detail}`);
    }
    const body = (await res.json()) as ChatCompletionBody;
    const choice = body.choices?.[0];
    const content = choice?.message?.content;
    if (typeof content !== 'string' || content.trim() === '') {
      throw new Error(`${host.label} returned no message content (finish_reason ${choice?.finish_reason ?? 'missing'})`);
    }
    return { content, finishReason: choice?.finish_reason ?? 'unknown' };
  } catch (err) {
    if (err instanceof Error && err.name === 'TimeoutError') {
      throw new AppError('PROVIDER_TIMEOUT', 504, 'The assistant took too long to reply. Please try again.');
    }
    throw err;
  }
}
