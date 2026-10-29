import { ZodError } from 'zod';
import { AssistantTurnSchema, type AssistantTurn } from '../../../shared/schemas';
import { AppError } from '../middleware/errors';

const MAX_RECOMMENDATIONS = 4;

/** Cleans up a valid turn: ranks, duplicates, and stage rules. */
function normalise(turn: AssistantTurn): AssistantTurn {
  const seen = new Set<string>();
  const recommendations = [...turn.recommendations]
    .sort((a, b) => a.rank - b.rank)
    .filter((r) => (seen.has(r.action) ? false : (seen.add(r.action), true)))
    .slice(0, MAX_RECOMMENDATIONS)
    .map((r, i) => ({ ...r, rank: i + 1 }));

  if (turn.stage === 'recommending') {
    if (recommendations.length === 0) return { ...turn, stage: 'gathering', recommendations: [] };
    return { ...turn, recommendations, followUpQuestion: null };
  }
  return { ...turn, recommendations: [] };
}

/** Validates a candidate turn and normalises it. Throws PROVIDER_ERROR when it is not a valid turn. */
export function normaliseTurn(candidate: unknown): AssistantTurn {
  const parsed = AssistantTurnSchema.safeParse(candidate);
  if (!parsed.success) {
    // Phase 4: for real models, make one repair call here (send the invalid output and the Zod error,
    // ask for corrected JSON only) and fall back to fallbackTurn() if it still fails.
    console.error('[turn] invalid assistant turn:', parsed.error.message);
    throw new AppError('PROVIDER_ERROR', 502, "The assistant's reply could not be read. Please try again.");
  }
  return normalise(parsed.data);
}

/** For model output: strips code fences and text outside the outermost JSON object, parses, and validates. */
export function parseModelOutput(raw: string): AssistantTurn | ZodError {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  const json = start >= 0 && end > start ? raw.slice(start, end + 1) : raw.replace(/```(?:json)?/gi, '').trim();
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    value = null; // reported by the schema as an invalid type
  }
  const parsed = AssistantTurnSchema.safeParse(value);
  return parsed.success ? parsed.data : parsed.error;
}

/** Last resort when model output cannot be repaired: show the raw text as a plain answer. */
export function fallbackTurn(rawText: string): AssistantTurn {
  return {
    stage: 'follow_up',
    message: rawText.trim(),
    followUpQuestion: null,
    quickReplies: [],
    recommendations: [],
    safetyWarnings: [],
  };
}
