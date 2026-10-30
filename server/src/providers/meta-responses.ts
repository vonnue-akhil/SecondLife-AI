// Minimal client for the Meta Model API Responses endpoint (https://dev.meta.ai/docs/protocols/responses.md),
// which serves web search, tool loops and SAM 3.1. Plain fetch, no SDK. Uses MODEL_API_KEY.
import { env } from '../config';

export interface WebSearchResult {
  type: string; // "text_result" for a web page
  title?: string;
  url: string;
  snippet?: string;
}

export type ResponseOutputItem =
  | { type: 'reasoning'; id?: string; summary?: unknown[]; encrypted_content?: string }
  | {
      type: 'message';
      role: 'assistant';
      phase?: 'commentary';
      content: { type: string; text?: string; annotations?: { type: string; url?: string; title?: string }[] }[];
    }
  | { type: 'function_call'; call_id: string; name: string; arguments: string }
  | { type: 'web_search_call'; status: string; results?: WebSearchResult[] }
  | { type: string; [key: string]: unknown };

export interface ResponseBody {
  id: string;
  status: string; // "completed", "incomplete", "failed", ...
  output: ResponseOutputItem[];
  error?: { message?: string } | null;
}

/** True when a Meta Model API key is configured. */
export const metaApiAvailable = () => Boolean(env.MODEL_API_KEY);

function request(body: Record<string, unknown>, signal: AbortSignal): Promise<Response> {
  if (!env.MODEL_API_KEY) throw new Error('MODEL_API_KEY is not set');
  return fetch(`${env.META_API_BASE_URL.replace(/\/+$/, '')}/responses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.MODEL_API_KEY}` },
    // store: false keeps no copy of the conversation or photo on the server.
    body: JSON.stringify({ store: false, ...body }),
    signal,
  });
}

async function failure(res: Response): Promise<Error> {
  // The error body describes the request problem; it never echoes the image back.
  const detail = (await res.text().catch(() => '')).slice(0, 500);
  return new Error(`Meta Model API returned HTTP ${res.status}: ${detail}`);
}

/** One non-streaming Responses call. */
export async function createResponse(body: Record<string, unknown>, signal: AbortSignal): Promise<ResponseBody> {
  const res = await request(body, signal);
  if (!res.ok) throw await failure(res);
  const json = (await res.json()) as ResponseBody;
  if (json.status !== 'completed') throw new Error(`Meta Model API response ${json.status}: ${json.error?.message ?? 'no detail'}`);
  return json;
}

/** One streaming Responses call, yielding each server-sent event's parsed JSON data. */
export async function* streamResponse(body: Record<string, unknown>, signal: AbortSignal): AsyncGenerator<{ type: string; [key: string]: unknown }> {
  const res = await request({ ...body, stream: true }, signal);
  if (!res.ok) throw await failure(res);
  if (!res.body) throw new Error('Meta Model API returned an empty stream');
  const decoder = new TextDecoder();
  let buffer = '';
  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    let end: number;
    while ((end = buffer.indexOf('\n\n')) >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (data && data !== '[DONE]') yield JSON.parse(data) as { type: string };
    }
  }
}

/** The final answer text: every output_text block outside commentary messages. */
export function outputText(response: ResponseBody): string {
  return response.output
    .filter((item): item is Extract<ResponseOutputItem, { type: 'message' }> => item.type === 'message' && !('phase' in item && item.phase === 'commentary'))
    .flatMap((item) => item.content.filter((c) => c.type === 'output_text').map((c) => c.text ?? ''))
    .join('');
}
