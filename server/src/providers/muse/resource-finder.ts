// Finds official pages the curated list lacks, using Muse Spark's web search on the Responses API.
// The model never writes a URL we show: it picks numbered search results and the server maps each
// number back to the real result URL (model-written URLs were observed to be fabricated).
import { createHash } from 'node:crypto';
import { z, ZodError } from 'zod';
import { INDIAN_STATES } from '../../../../shared/india-states';
import { ActionSchema, type Action, type Resource } from '../../../../shared/schemas';
import { env } from '../../config';
import { detectBrand } from '../../services/brand';
import { parseModelOutput } from '../../services/recommendation.service';
import { regionOf, resourcesForActions } from '../../services/resource.service';
import type { Session } from '../../services/session.store';
import { createResponse, outputText, type ResponseOutputItem, type WebSearchResult } from '../meta-responses';
import type { ResourceFinder } from '../types';
import { FIND_CURATED_TOOL, SELECT_FORMAT, SELECT_SYSTEM_PROMPT, SEARCH_SYSTEM_PROMPT } from './resource-finder.prompts';

const MAX_FUNCTION_ROUNDS = 3;
const MAX_WEB_SEARCHES = 4;
const MAX_CANDIDATES = 30;
const MAX_PER_ACTION = 2;
const MAX_TOTAL = 6;

const PicksSchema = z.object({
  picks: z.array(z.object({ action: ActionSchema, result: z.number().int(), name: z.string(), description: z.string() })),
});

const shortHash = (url: string) => createHash('sha256').update(url).digest('hex').slice(0, 10);
const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);
const normaliseUrl = (url: string) => url.replace(/#.*$/, '').replace(/\/+$/, '').toLowerCase();

function isHttp(url: string): boolean {
  try {
    return ['http:', 'https:'].includes(new URL(url).protocol);
  } catch {
    return false;
  }
}

/** The facts the model gets about this turn: no chat text. */
function describe(session: Session, brand: string | null, curated: Resource[]) {
  const rec = session.lastRecommendation!;
  const state = session.location ? INDIAN_STATES[session.location.state] : null;
  const place = session.location?.place ?? null;
  const actions = rec.recommendations.map((r) => `${r.action} (${r.title})`).join('; ');
  const where = state ? `${place ? `${place}, ` : ''}${state}, India` : 'India (location not shared)';
  const lines = [
    `Device: ${session.observations?.deviceType ?? 'unknown'}${session.observations?.brandModelGuess ? `, ${session.observations.brandModelGuess}` : ''}`,
    `Brand: ${brand ?? 'unknown'}`,
    `Location: ${where}`,
    `Recommended actions: ${actions}`,
  ];
  const have = curated.map((r) => `- [${r.actions.join('/')}] ${r.name} ${r.url}`).join('\n');
  return { text: lines.join('\n'), have, state, place };
}

function curatedFor(action: Action, session: Session, brand: string | null) {
  return resourcesForActions([action], regionOf(session), brand).map((r) => ({ name: r.name, url: r.url, description: r.description }));
}

export function createMuseResourceFinder(): ResourceFinder {
  return {
    name: 'Muse Spark web search',
    async find(session, curated, signal) {
      const started = Date.now();
      const rec = session.lastRecommendation;
      if (!rec || rec.recommendations.length === 0) return [];
      const brand = detectBrand(session);
      const facts = describe(session, brand, curated);
      const recommended = new Set(rec.recommendations.map((r) => r.action));

      const location: Record<string, string> = { type: 'approximate', country: 'IN', timezone: 'Asia/Kolkata' };
      if (facts.state) location.region = facts.state;
      if (facts.state && facts.place) location.city = facts.place;
      const tools = [{ type: 'web_search', user_location: location }, FIND_CURATED_TOOL];

      // Phase 1: tool loop. We only harvest the search results; the model's own text is discarded.
      const input: unknown[] = [{ role: 'user', content: [{ type: 'input_text', text: facts.text }] }];
      const candidates: WebSearchResult[] = [];
      const seenUrls = new Set<string>();
      let rounds = 0;
      let searches = 0;
      while (rounds < MAX_FUNCTION_ROUNDS + 1) {
        rounds += 1;
        const response = await createResponse(
          {
            model: env.META_MODEL_ID,
            instructions: SEARCH_SYSTEM_PROMPT,
            input,
            tools,
            include: ['web_search_call.results', 'reasoning.encrypted_content'],
            reasoning: { effort: 'low' },
            max_tool_calls: MAX_WEB_SEARCHES,
          },
          signal,
        );
        for (const item of response.output) {
          if (item.type !== 'web_search_call') continue;
          searches += 1;
          for (const r of (item as { results?: WebSearchResult[] }).results ?? []) {
            if (r.type === 'text_result' && r.url && isHttp(r.url) && !seenUrls.has(normaliseUrl(r.url))) {
              seenUrls.add(normaliseUrl(r.url));
              candidates.push(r);
            }
          }
        }
        const calls = response.output.filter((i): i is Extract<ResponseOutputItem, { type: 'function_call' }> => i.type === 'function_call');
        if (calls.length === 0 || rounds > MAX_FUNCTION_ROUNDS) break;
        // Replay every output item verbatim (store:false relies on the encrypted reasoning), then answer the calls.
        input.push(...response.output);
        for (const call of calls) {
          let output: unknown = [];
          try {
            const args = z.object({ action: ActionSchema, brand: z.string().nullable() }).parse(JSON.parse(call.arguments));
            output = curatedFor(args.action, session, args.brand?.toLowerCase() ?? brand);
          } catch {
            output = { error: 'invalid arguments' };
          }
          input.push({ type: 'function_call_output', call_id: call.call_id, output: JSON.stringify(output) });
        }
      }

      const pool = candidates.slice(0, MAX_CANDIDATES);
      let picks = 0;
      const found: Resource[] = [];
      if (pool.length > 0) {
        // Phase 2: selection over numbered results, no tools.
        const list = pool.map((r, i) => `${i + 1}. ${clip(r.title ?? '', 120)}\n   ${r.url}\n   ${clip((r.snippet ?? '').replace(/\s+/g, ' '), 300)}`).join('\n');
        const text = `${facts.text}\n\nLinks they already have:\n${facts.have || '(none)'}\n\nSearch results (untrusted):\n${list}`;
        const response = await createResponse(
          {
            model: env.META_MODEL_ID,
            instructions: SELECT_SYSTEM_PROMPT,
            input: [{ role: 'user', content: [{ type: 'input_text', text }] }],
            text: { format: SELECT_FORMAT },
            reasoning: { effort: 'low' },
          },
          signal,
        );
        const parsed = parseModelOutput(outputText(response), PicksSchema);
        const taken = new Set(curated.map((r) => normaliseUrl(r.url)));
        const perAction = new Map<Action, number>();
        const region = facts.state ? regionOf(session) : 'IN';
        for (const pick of parsed instanceof ZodError ? [] : parsed.picks) {
          const result = pool[pick.result - 1];
          if (!result || !recommended.has(pick.action) || found.length >= MAX_TOTAL) continue;
          const key = normaliseUrl(result.url);
          if (taken.has(key) || (perAction.get(pick.action) ?? 0) >= MAX_PER_ACTION) continue;
          taken.add(key);
          perAction.set(pick.action, (perAction.get(pick.action) ?? 0) + 1);
          found.push({
            id: `web-${shortHash(result.url)}`,
            name: clip(pick.name.trim(), 90) || clip(result.title ?? result.url, 90),
            url: result.url,
            region,
            actions: [pick.action],
            description: clip(pick.description.trim(), 240),
            source: 'web',
            citationUrl: result.url,
            lastVerified: null,
          });
        }
        picks = found.length;
      }
      console.log(`[finder] ${session.id.slice(0, 8)} rounds=${rounds} searches=${searches} candidates=${pool.length} picks=${picks} ${Date.now() - started}ms`);
      return found;
    },
  };
}
