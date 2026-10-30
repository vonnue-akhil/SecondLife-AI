// Deterministic battery and electrical hazard check. Independent of the model: it scans what the user said,
// what the photo analysis noted, and the highlighted regions. Understands English, Hinglish (Hindi
// in Latin letters) and Hindi in Devanagari, since users can speak or type in Hindi.
import type { AssistantTurn, DamageRegion, Recommendation } from '../../../shared/schemas';
import type { Session } from './session.store';

export const SAFETY_WARNING =
  'Possible safety hazard: stop using the device, and unplug it or stop charging it if you can do so safely. ' +
  "Don't open it, and don't puncture, press on or try to remove a battery. Keep it away from anything flammable, " +
  'and take it to a qualified repair shop or e-waste collection point.';

const SAFETY_WARNING_HI =
  'ख़तरे की आशंका: डिवाइस का इस्तेमाल बंद करें, और अगर सुरक्षित हो तो प्लग निकाल दें या चार्ज करना रोक दें। ' +
  'इसे ख़ुद न खोलें, और बैटरी को छेदें, दबाएँ या निकालने की कोशिश न करें। इसे ज्वलनशील चीज़ों से दूर रखें और ' +
  'किसी योग्य रिपेयर शॉप या ई-वेस्ट कलेक्शन पॉइंट पर ले जाएँ।';

/** Replies Muse Spark wrote in Devanagari get the fixed safety copy in Hindi too. */
const isHindi = (turn: AssistantTurn) => /\p{Script=Devanagari}/u.test(turn.message);

// "leak" counts only with a battery, gas or chemical (a washing machine leaking water is not a fire risk), and
// "hot air" or "hot water" is a normal appliance complaint.
const HAZARD_TERMS =
  /\b(swollen|swelling|swelled|bulging|bulge[sd]?|puffy|puffed up|battery pushing|hot(?!\s+(?:air|water)\b)|overheat\w*|burning smell|burnt smell|smells? (?:burnt|burning)|burn marks?|scorch\w*|melt(?:ed|ing|s)?|smok(?:e|ing)|spark(?:s|ing)?|short[- ]circuit\w*|(?:electric(?:al)?\s+)?shocks?|(?:battery|gas|acid|chemical|refrigerant)\s+(?:is\s+|was\s+)?leak(?:s|ing|ed|age)?|leak(?:s|ing|ed)?\s+(?:battery\s+)?(?:acid|gas|chemicals?|refrigerant)|exposed wires?|fire(?!\s*(?:tablet|hd|stick|tv|phone|os)\b)|flames?)\b/gi;

// Hinglish: phool/fool gaya (swollen), garam (hot), dhuan (smoke), aag (fire), jal gaya (burnt), chingari (spark),
// current lagta / jhatka (electric shock), pighal gaya (melted).
const HINGLISH_TERMS =
  /\b((?:phool|fool|phul|ful)(?:a|i|e)?\s+(?:gay[aie]|gai|rah[aie])|(?:bahut\s+)?garam(?!\s+(?:hawa|paani|pani)\b)|dhu(?:a|aa|an|aan|ann)|aag|jal\s+(?:gay[aie]|gai|rah[aie])|jalne\s+ki|chingari|(?:battery|gas)\s+leak|current\s+(?:lag|maar)\w*|jhatk[aei]|pighal\w*)\b/gi;

// Devanagari. JavaScript's \b only knows ASCII letters, so edges are explicit lookarounds. फूल alone also
// means "flower", so it only counts next to बैटरी (battery) or with a verb ending.
const HINDI_TERMS =
  /(?<![\p{L}\p{M}])(बैटरी.{0,15}फूल|फूल(?:ी|ा|े)?\s*(?:गई|गयी|गया|गए|रही|रहा)|सूज\p{M}*\p{L}*|(?:गर्म|गरम)(?!\s*(?:हवा|पानी))|धु(?:आ|ँआ|ंआ)\p{M}*|आग|जल\s*(?:गई|गयी|गया|रही|रहा)|जलने|चिंगारी|(?:बैटरी|गैस).{0,10}लीक|करंट|झटका|पिघल\p{M}*\p{L}*)(?![\p{L}\p{M}])/gu;

const NEGATORS = new Set([
  'not', 'no', 'never', 'without', 'nor', 'isnt', "isn't", 'arent', "aren't", 'doesnt', "doesn't", 'dont', "don't",
  'wasnt', "wasn't", 'hasnt', "hasn't", 'didnt', "didn't", 'havent', "haven't", 'cant', "can't", 'neither',
]);
// Hindi negates after the word: "garam nahi hai", "गर्म नहीं है". Not "na"/"ना": it is also a tag question
// ("garam hai na?"), and a missed hazard is worse than an extra warning.
const POST_NEGATORS = new Set(['nahi', 'nahin', 'nai', 'नहीं', 'नही', 'न']);
const CLAUSE_BREAK = /[.,;:!?\n।]/;

/** Matches of `re` not negated by one of the three preceding words ("not hot") or, Hindi-style, the two following ones. */
export function unnegatedMatches(text: string, re: RegExp): string[] {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  const found: string[] = [];
  for (const m of text.matchAll(new RegExp(re.source, flags))) {
    const before = text.slice(0, m.index).split(CLAUSE_BREAK).pop() ?? '';
    const after = text.slice(m.index + m[0].length).split(CLAUSE_BREAK)[0] ?? '';
    const words = (s: string) => s.toLowerCase().replace(/[’]/g, "'").split(/\s+/).filter(Boolean);
    if (words(before).slice(-3).some((w) => NEGATORS.has(w))) continue;
    if (words(after).slice(0, 2).some((w) => POST_NEGATORS.has(w))) continue;
    found.push(m[0]);
  }
  return found;
}

export function hazardTerms(text: string): string[] {
  return [HAZARD_TERMS, HINGLISH_TERMS, HINDI_TERMS].flatMap((re) => unnegatedMatches(text, re));
}

const SWOLLEN_REGION = /(swollen|swelling|bulg|puff).{0,20}battery|battery.{0,20}(swollen|swelling|bulg|puff)/i;

export function regionsShowHazard(regions: DamageRegion[]): boolean {
  return regions.some((r) => r.score >= 0.5 && SWOLLEN_REGION.test(`${r.concept} . ${r.label}`));
}

/** True when anything the user said, the photo analysis or a highlighted region points to a battery or electrical hazard. */
export function detectHazard(session: Session): boolean {
  const userText = session.messages.filter((m) => m.role === 'user').map((m) => m.text);
  const observed = session.observations?.possibleHazards ?? [];
  return [...userText, ...observed].some((t) => hazardTerms(t).length > 0) || regionsShowHazard(session.damageRegions);
}

const DIY_BATTERY = [
  /(remove|replace|take out|pry|swap|open).{0,40}battery/i,
  /battery.{0,30}\b(nikal|nikaal|badal|khol)/i, // Hinglish
  /बैटरी.{0,30}(निकाल|बदल|खोल)|(निकाल|बदल|खोल).{0,30}बैटरी/u,
];
const NEGATED_OR_PROFESSIONAL = [
  /\b(don'?t|do not|never|avoid|professional|technician|service cent(?:re|er)|authori[sz]ed|qualified|repair shop|mat|na karein|na karen)\b/i,
  /(मत|न करें|नहीं|सर्विस सेंटर|तकनीशियन|टेक्नीशियन|अधिकृत|योग्य|रिपेयर शॉप)/u,
];

function isDiyBatteryStep(step: string): boolean {
  return DIY_BATTERY.some((re) => re.test(step)) && !NEGATED_OR_PROFESSIONAL.some((re) => re.test(step));
}

function renumber(recs: Recommendation[]): Recommendation[] {
  return recs.map((r, i) => ({ ...r, rank: i + 1 }));
}

const STOP_USE_REC: Recommendation = {
  action: 'stop_use',
  rank: 1,
  title: 'Stop using it and keep it safe',
  reason: 'Something in this conversation points to a possible battery or electrical hazard, which matters more than any other choice.',
  nextSteps: [
    'Switch it off, and unplug it or stop charging it, if you can do so safely.',
    'Keep it away from anything flammable, and from children and pets.',
    'Take it to a qualified repair shop or an e-waste collection point and tell them what you noticed.',
  ],
  confidence: 'high',
  limitations: ["I can't confirm a hazard from text or a photo; a technician needs to check it."],
};

const STOP_USE_REC_HI: Recommendation = {
  action: 'stop_use',
  rank: 1,
  title: 'इस्तेमाल बंद करें और इसे सुरक्षित रखें',
  reason: 'इस बातचीत में बैटरी या बिजली से जुड़े ख़तरे के संकेत हैं, और यह किसी भी दूसरे फ़ैसले से ज़्यादा ज़रूरी है।',
  nextSteps: [
    'अगर सुरक्षित हो तो इसे बंद करें, और प्लग निकाल दें या चार्ज करना रोक दें।',
    'इसे ज्वलनशील चीज़ों से, और बच्चों व पालतू जानवरों से दूर रखें।',
    'इसे किसी योग्य रिपेयर शॉप या ई-वेस्ट कलेक्शन पॉइंट पर ले जाएँ और उन्हें बताएँ कि आपने क्या देखा।',
  ],
  confidence: 'high',
  limitations: ['मैं टेक्स्ट या फ़ोटो से ख़तरे की पुष्टि नहीं कर सकता; इसे किसी तकनीशियन से जाँच करवाना ज़रूरी है।'],
};

/** Applies the safety rules to a normalised turn. Always strips DIY battery steps; adds hazard handling on a match. */
export function applySafety(turn: AssistantTurn, hazard: boolean): AssistantTurn {
  const hindi = isHindi(turn);
  let recs = turn.recommendations.map((r) => {
    let steps = r.nextSteps.filter((s) => !isDiyBatteryStep(s));
    if (steps.length === 0) {
      steps = [hindi ? 'बैटरी का काम किसी अधिकृत सर्विस सेंटर या योग्य रिपेयर शॉप से ही करवाएँ।' : 'Ask an authorised service centre or qualified repair shop to handle the battery.'];
    }
    return { ...r, nextSteps: steps };
  });
  const warnings = [...turn.safetyWarnings];

  if (hazard) {
    const warning = hindi ? SAFETY_WARNING_HI : SAFETY_WARNING;
    if (!warnings.includes(warning)) warnings.push(warning);
    const top = recs[0];
    if (top && top.action !== 'stop_use' && top.action !== 'recycle') recs = renumber([hindi ? STOP_USE_REC_HI : STOP_USE_REC, ...recs]);
  }
  return { ...turn, recommendations: recs, safetyWarnings: warnings };
}
