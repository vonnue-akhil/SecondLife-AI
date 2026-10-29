// Deterministic battery and hazard check. Independent of the model: it scans what the user said,
// what the photo analysis noted, and the highlighted regions.
import type { AssistantTurn, DamageRegion, Recommendation } from '../../../shared/schemas';
import type { Session } from './session.store';

export const BATTERY_WARNING =
  "Possible battery hazard: stop using and charging the device. Don't puncture, press on or try to remove the battery. " +
  'Keep it away from anything flammable, and take it to a qualified repair shop or e-waste collection point.';

const HAZARD_TERMS =
  /\b(swollen|swelling|swelled|bulging|bulge[sd]?|puffy|puffed up|battery pushing|hot|overheat\w*|burning smell|smok(?:e|ing)|spark(?:s|ing)?|leak(?:s|ing|ed)?|exposed wires?|fire(?!\s*(?:tablet|hd|stick|tv|phone|os)\b)|flames?)\b/gi;

const NEGATORS = new Set([
  'not', 'no', 'never', 'without', 'nor', 'isnt', "isn't", 'arent', "aren't", 'doesnt', "doesn't", 'dont', "don't",
  'wasnt', "wasn't", 'hasnt', "hasn't", 'didnt', "didn't", 'havent', "haven't", 'cant', "can't", 'neither',
]);

/** Matches of `re` that are not negated by one of the three preceding words ("not hot", "no smoke"). */
export function unnegatedMatches(text: string, re: RegExp): string[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const found: string[] = [];
  for (const m of text.matchAll(new RegExp(re.source, flags))) {
    const clause = text.slice(0, m.index).split(/[.,;:!?\n]/).pop() ?? '';
    const words = clause.toLowerCase().replace(/[’]/g, "'").split(/\s+/).filter(Boolean).slice(-3);
    if (!words.some((w) => NEGATORS.has(w))) found.push(m[0]);
  }
  return found;
}

export function hazardTerms(text: string): string[] {
  return unnegatedMatches(text, HAZARD_TERMS);
}

const SWOLLEN_REGION = /(swollen|swelling|bulg|puff).{0,20}battery|battery.{0,20}(swollen|swelling|bulg|puff)/i;

export function regionsShowHazard(regions: DamageRegion[]): boolean {
  return regions.some((r) => r.score >= 0.5 && SWOLLEN_REGION.test(r.concept));
}

/** True when anything the user said, the photo analysis or a highlighted region points to a battery hazard. */
export function detectHazard(session: Session): boolean {
  const userText = session.messages.filter((m) => m.role === 'user').map((m) => m.text);
  const observed = session.observations?.possibleHazards ?? [];
  return [...userText, ...observed].some((t) => hazardTerms(t).length > 0) || regionsShowHazard(session.damageRegions);
}

const DIY_BATTERY = /(remove|replace|take out|pry|swap|open).{0,40}battery/i;
const NEGATED_OR_PROFESSIONAL =
  /\b(don'?t|do not|never|avoid|professional|technician|service cent(?:re|er)|authori[sz]ed|qualified|repair shop)\b/i;

function isDiyBatteryStep(step: string): boolean {
  return DIY_BATTERY.test(step) && !NEGATED_OR_PROFESSIONAL.test(step);
}

function renumber(recs: Recommendation[]): Recommendation[] {
  return recs.map((r, i) => ({ ...r, rank: i + 1 }));
}

const STOP_USE_REC: Recommendation = {
  action: 'stop_use',
  rank: 1,
  title: 'Stop using it and keep it safe',
  reason: 'Something in this conversation points to a possible battery hazard, which matters more than any other choice.',
  nextSteps: [
    'Switch the device off if you can do so safely, and stop charging it.',
    'Keep it on a hard surface away from anything flammable.',
    'Take it to a qualified repair shop or an e-waste collection point and tell them about the battery.',
  ],
  confidence: 'high',
  limitations: ["I can't confirm a battery problem from text or a photo; a technician needs to check it."],
};

/** Applies the safety rules to a normalised turn. Always strips DIY battery steps; adds hazard handling on a match. */
export function applySafety(turn: AssistantTurn, hazard: boolean): AssistantTurn {
  let recs = turn.recommendations.map((r) => {
    let steps = r.nextSteps.filter((s) => !isDiyBatteryStep(s));
    if (steps.length === 0) steps = ['Ask an authorised service centre or qualified repair shop to handle the battery.'];
    return { ...r, nextSteps: steps };
  });
  const warnings = [...turn.safetyWarnings];

  if (hazard) {
    if (!warnings.includes(BATTERY_WARNING)) warnings.push(BATTERY_WARNING);
    const top = recs[0];
    if (top && top.action !== 'stop_use' && top.action !== 'recycle') recs = renumber([STOP_USE_REC, ...recs]);
  }
  return { ...turn, recommendations: recs, safetyWarnings: warnings };
}
