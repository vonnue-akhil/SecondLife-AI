// Boils the whole conversation down to facts the demo scripts can reason over.
import type { Session } from '../../services/session.store';
import { unnegatedMatches } from '../../services/safety.service';

export type Answer = 'yes' | 'partial' | 'no' | 'unknown';
export type QuestionId = 'type' | 'touch' | 'water' | 'age' | 'condition';
export type Condition = 'good' | 'ok' | 'worn' | 'unknown';

export interface Facts {
  deviceNoun: string; // "phone", "laptop", "tablet", "device"...
  deviceKnown: boolean;
  touch?: Answer;
  water?: Answer;
  age?: number | 'unknown'; // years
  condition?: Condition;
  asked: Set<QuestionId>;
  /** The user's latest message answered our question with "don't know / not sure". */
  justUnsure: boolean;
  userText: string; // every user message joined (photo placeholders removed)
}

export const PHOTO_PLACEHOLDER = '(sent a photo)';

// The mock recognises its own questions by these patterns when it reads the history.
export const QUESTION_PATTERNS: [QuestionId, RegExp][] = [
  ['type', /what kind of device/i],
  ['touch', /touchscreen still respond/i],
  ['water', /exposed to water/i],
  ['age', /roughly how old/i],
  ['condition', /describe its condition/i],
];

const UNSURE = /not sure|unsure|don'?t know|dont know|no idea|can'?t say|can'?t tell|pata nahi|\bidk\b/i;

export function parseAnswer(text: string): Answer | undefined {
  const t = text.trim().toLowerCase();
  if (UNSURE.test(t)) return 'unknown';
  if (/partly|partially|sometimes|patchy|some areas|a bit|somewhat|intermittent/.test(t)) return 'partial';
  if (/^(yes|yeah|yep|yup|haan|sure|y)\b/.test(t)) return 'yes';
  if (/^(no|nope|nah|nahi|never|n)\b/.test(t)) return 'no';
  return undefined;
}

const WORD_NUMBERS: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

/** Age in years from phrases like "5 years old", "2-5 years", "over 5 years", "bought in 2019". */
export function parseAge(text: string): number | 'unknown' | undefined {
  const t = text.toLowerCase();
  if (UNSURE.test(t)) return 'unknown';
  const year = t.match(/\b(?:bought|purchased|since|from|in)\s+(?:in\s+)?((?:19|20)\d\d)\b/);
  if (year) return Math.max(0, new Date().getFullYear() - Number(year[1]));
  if (/\b(\d+|few)\s*months?\b|brand new|under (?:1|a|one) year/.test(t)) return 0.5;
  const range = t.match(/\b(\d{1,2})\s*(?:-|–|to)\s*(\d{1,2})\s*(?:years?|yrs?)?\b/);
  if (range) return (Number(range[1]) + Number(range[2])) / 2;
  const num = t.match(/\b(\d{1,2}(?:\.\d)?)\s*\+?\s*(?:years?|yrs?)\b/);
  const word = Object.keys(WORD_NUMBERS).find((w) => new RegExp(`\\b${w}\\s*(?:years?|yrs?)`).test(t));
  let n = num ? Number(num[1]) : word ? WORD_NUMBERS[word] : undefined;
  if (n === undefined) return undefined;
  if (/\b(under|less than|below|within)\b/.test(t)) return Math.max(0, n - 1);
  if (/\b(over|more than|above|\d\s*\+)/.test(t) || /\+/.test(t)) n += 1;
  return n;
}

function touchFromText(t: string): Answer | undefined {
  if (!/touch|respon/i.test(t)) return undefined;
  if (/touch[^.]{0,40}(partly|partially|some areas|patchy|sometimes|intermittent)|(partly|patchy)[^.]{0,20}touch/i.test(t)) return 'partial';
  if (/touch[^.]{0,40}(doesn'?t|does not|not|isn'?t|stopped|unresponsive|dead|ghost)|unresponsive/i.test(t)) return 'no';
  if (/touch[^.]{0,40}(works?|fine|ok|okay|responds?|responsive)/i.test(t)) return 'yes';
  return undefined;
}

function waterFromText(t: string): Answer | undefined {
  if (unnegatedMatches(t, /\b(water damage|water|wet|liquid|spill\w*|rain|submerged|splash\w*)\b/i).length > 0) return 'yes';
  if (/\b(no|not|never)\b[^.]{0,20}\b(water|wet|liquid|spill\w*)\b/i.test(t)) return 'no';
  return undefined;
}

function conditionFromText(t: string): Condition | undefined {
  if (/like new|perfect|mint|excellent|good condition|no (?:obvious )?damage/i.test(t)) return 'good';
  if (/normal wear|some wear|minor|light(?:ly)? used|okay condition|scuff/i.test(t)) return 'ok';
  if (/quite worn|rough|worn|scratched|dented|damaged|beaten/i.test(t)) return 'worn';
  return undefined;
}

const DEVICE_WORDS: [RegExp, string][] = [
  [/\b(ipad|tablet|tab)\b/, 'tablet'],
  [/\b(macbook|laptop|notebook|chromebook)\b/, 'laptop'],
  [/\b(smart ?phone|phone|mobile|iphone|android|galaxy|redmi|oneplus|pixel|realme|oppo|vivo)\b/, 'phone'],
  [/\b(smart ?watch|watch)\b/, 'smartwatch'],
  [/\b(tv|television|camera|speaker|headphones?|earbuds?|printer|router|console|monitor|keyboard|power ?bank|e-?reader|kindle)\b/, ''],
];

/** The kind of device mentioned in the text, as a lowercase noun ("phone"), or null. */
export function deviceFromText(text: string): string | null {
  const t = text.toLowerCase();
  for (const [re, noun] of DEVICE_WORDS) {
    const m = t.match(re);
    if (m) return noun || m[1]!.replace('television', 'TV');
  }
  return null;
}

export const isSmartphoneNoun = (s: string) => s === 'phone';

export function extractFacts(session: Session): Facts {
  const msgs = session.messages;
  const answers = new Map<QuestionId, string>();
  const asked = new Set<QuestionId>();
  let justUnsure = false;

  msgs.forEach((m, i) => {
    if (m.role !== 'assistant') return;
    const qid = QUESTION_PATTERNS.find(([, re]) => re.test(m.text))?.[0];
    if (!qid) return;
    asked.add(qid);
    const reply = msgs[i + 1];
    if (reply?.role === 'user') {
      answers.set(qid, reply.text);
      if (i + 1 === msgs.length - 1 && UNSURE.test(reply.text)) justUnsure = true;
    }
  });

  const userMessages = msgs.filter((m) => m.role === 'user').map((m) => m.text).filter((t) => t !== PHOTO_PLACEHOLDER);
  const userText = userMessages.join(' \n ');

  let device: string | null = null;
  for (const t of [...userMessages].reverse()) if ((device = deviceFromText(t))) break;
  if (!device && session.observations) device = deviceFromText(session.observations.deviceType);

  const ans = (q: QuestionId) => answers.get(q);
  const touchAnswer = ans('touch');
  const waterAnswer = ans('water');
  const ageAnswer = ans('age');
  const condAnswer = ans('condition');

  let condition: Condition | undefined;
  if (condAnswer !== undefined) condition = UNSURE.test(condAnswer) ? 'unknown' : conditionFromText(condAnswer);
  condition ??= conditionFromText(userText);

  const freeAgeRaw = parseAge(userText);
  const freeAge = freeAgeRaw === 'unknown' ? undefined : freeAgeRaw;

  return {
    deviceNoun: device ?? 'device',
    deviceKnown: device !== null,
    touch: (touchAnswer !== undefined ? parseAnswer(touchAnswer) : undefined) ?? touchFromText(userText),
    water: (waterAnswer !== undefined ? parseAnswer(waterAnswer) : undefined) ?? waterFromText(userText),
    age: (ageAnswer !== undefined ? parseAge(/^\s*\d{1,2}\s*$/.test(ageAnswer) ? `${ageAnswer} years` : ageAnswer) : undefined) ?? freeAge,
    condition,
    asked,
    justUnsure,
    userText,
  };
}
