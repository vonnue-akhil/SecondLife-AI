// Scripted conversations for the demo (mock) assessment provider. Content rules, same as for a real model:
// never state costs, prices, availability or environmental figures; observations from a photo are
// preliminary, not a diagnosis; never suggest DIY battery work; never name businesses (curated resources do).
import type { AssistantTurn, DeviceObservations, Recommendation } from '../../../shared/schemas';
import type { Answer, Facts } from '../providers/mock/facts';
import { unnegatedMatches } from '../services/safety.service';

export type ScriptId = 'swollen' | 'cracked' | 'dead' | 'working' | 'fallback';

// ---------------------------------------------------------------------------
// Script choice
// ---------------------------------------------------------------------------

const CRACKED =
  /\b(crack\w*|shatter\w*|smash\w*)\b|\b(broken|damaged|chipped)\b[^.]{0,20}\b(screen|display|glass)\b|\b(screen|display|glass)\b[^.]{0,20}\b(broke|broken|damaged|chipped)\b/i;
const DEAD =
  /\b(won'?t|wont|will not|doesn'?t|does not|not|can'?t|cannot|unable to)\s+(turn(?:ing)?|switch(?:ing)?|power(?:ing)?|boot(?:ing)?|start(?:ing)?|wake|charg\w*|respond(?:ing)?)|\bdead\b|no power|black screen|no display|stopped working|not working|doesn'?t work|bricked|boot ?loop/i;
const WATER = /\b(water damage|water|wet|liquid|spill\w*|rain|submerged|splash\w*)\b/i;
const WORKING =
  /\b(old|still works?|works? (?:fine|well)|working (?:fine|well)|upgrad\w+|spare|unused|drawer|not using|don'?t use|dont use|no longer use|lying around|replaced)\b/i;
const BARE_SCREEN = /\b(screen|display)\b/i;

/** Priority: swollen > cracked > dead > working > bare "screen" > fallback, so later answers don't flip the script. */
export function chooseScript(hazard: boolean, userText: string, obs: DeviceObservations | null): ScriptId {
  if (hazard) return 'swollen';
  const observed = obs ? [obs.deviceType, ...obs.visibleCondition, ...obs.possibleHazards, ...obs.damageAreas.map((a) => a.label)].join(' . ') : '';
  const all = `${userText} . ${observed}`;
  if (unnegatedMatches(all, CRACKED).length > 0) return 'cracked';
  if (DEAD.test(all) || unnegatedMatches(all, WATER).length > 0) return 'dead';
  if (WORKING.test(all)) return 'working';
  if (BARE_SCREEN.test(userText)) return 'cracked';
  return 'fallback';
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

export interface ScriptContext {
  facts: Facts;
  observations: DeviceObservations | null;
  followUpsAsked: number;
  maxFollowUps: number;
}

const gather = (message: string, question: string, quickReplies: string[]): AssistantTurn => ({
  stage: 'gathering',
  message,
  followUpQuestion: question,
  quickReplies,
  recommendations: [],
  safetyWarnings: [],
});

const recommend = (message: string, recommendations: Recommendation[]): AssistantTurn => ({
  stage: 'recommending',
  message,
  followUpQuestion: null,
  quickReplies: [],
  recommendations,
  safetyWarnings: [],
});

const canAsk = (c: ScriptContext) => !c.facts.justUnsure && c.followUpsAsked < c.maxFollowUps;

/** One sentence about what the photo suggested, if a photo was analysed. Always framed as preliminary. */
function photoHint(c: ScriptContext): string {
  const seen = (c.observations?.visibleCondition ?? []).filter((v) => !v.startsWith('highlighted on photo'));
  if (!c.observations || c.observations.confidence === 'low' || seen.length === 0) return '';
  return `From the photo it looks like: ${seen.join(', ')} (that's a first impression, not a diagnosis). `;
}

const ageText = (years: number) => (years < 1 ? 'less than a year old' : `about ${Math.round(years)} year${Math.round(years) === 1 ? '' : 's'} old`);

const WIPE_STEPS = [
  'Back up anything you want to keep, such as photos, contacts and files.',
  'Sign out of your accounts (Google, Apple, Microsoft and any others) and turn off any find-my-device or activation lock.',
  'Remove the SIM card and any memory card.',
  'Factory reset the device, then check that it restarts at the first-time setup screen.',
];

// ---------------------------------------------------------------------------
// Cracked screen
// ---------------------------------------------------------------------------

const TOUCH_QUESTION = 'Does the touchscreen still respond everywhere, including right next to the crack?';

export function crackedTurn(c: ScriptContext): AssistantTurn {
  const { facts } = c;
  const noun = facts.deviceNoun;
  if (facts.touch === undefined && canAsk(c)) {
    return gather(
      `${photoHint(c)}A cracked screen on your ${noun} is often something a technician can deal with, and one detail changes what I'd suggest first.`,
      TOUCH_QUESTION,
      ['Yes, touch works fine', "Partly, some areas don't respond", 'No, touch is unresponsive', 'Not sure'],
    );
  }

  const touch: Answer = facts.touch ?? 'unknown';
  const touchFact =
    touch === 'yes'
      ? 'you said touch still works'
      : touch === 'partial'
        ? 'you said touch only partly works'
        : touch === 'no'
          ? 'you said touch is unresponsive'
          : "you weren't sure whether touch works everywhere";
  const repairReason =
    touch === 'yes'
      ? `The screen is cracked but ${touchFact}, which suggests the damage may be limited to the glass. A repair is usually worth getting a quote for in that case.`
      : touch === 'unknown'
        ? `The screen is cracked and ${touchFact}, so I can't tell how deep the damage goes. A quote from a technician will settle that.`
        : `The screen is cracked and ${touchFact}, so more than the glass may be damaged. A technician can tell you what needs replacing.`;
  const limitations = [
    "I can't judge the damage from a photo or description; a technician needs to inspect it.",
    `Whether repair is worth it depends on the quote compared with what the ${noun} is worth to you, which I cannot predict.`,
  ];
  if (touch === 'unknown') limitations.push('Because touch behaviour is unknown, this ranking is less certain.');

  return recommend(
    `Here's how I'd rank your options for the ${noun} with the cracked screen. ${photoHint(c)}Repair looks like the best first step, with selling it as-is or recycling as fallbacks.`,
    [
      {
        action: 'repair',
        rank: 1,
        title: 'Get the screen repaired',
        reason: repairReason,
        nextSteps: [
          'Cover the crack with clear tape so glass chips do not cut you or spread.',
          'Back up your data now, in case the repair involves a reset.',
          'Ask an authorised service centre and one independent repair shop for a written quote for the screen.',
          'Compare each quote with what you would pay for a similar used device, and ask what warranty the repair carries.',
        ],
        confidence: touch === 'yes' ? 'high' : touch === 'unknown' ? 'low' : 'medium',
        limitations,
      },
      {
        action: 'resell',
        rank: 2,
        title: 'Sell it as-is',
        reason:
          'If the quote is not worth it to you, some buyers and refurbishers take devices with a cracked screen. Being upfront about the crack keeps it fair.',
        nextSteps: [...WIPE_STEPS, 'Describe the crack honestly and compare offers from a few buyers or trade-in programmes.'],
        confidence: 'low',
        limitations: ['What buyers offer depends on the model, age and condition, and I cannot estimate it.'],
      },
      {
        action: 'recycle',
        rank: 3,
        title: 'Recycle it responsibly',
        reason: 'If it is not worth repairing or selling, an authorised e-waste channel keeps the parts out of landfill.',
        nextSteps: [
          'Back up your data, sign out of your accounts and remove the SIM and any memory card.',
          'Use a CPCB-authorised recycler or the maker\'s take-back programme rather than an informal scrap dealer.',
          'Ask whether they accept devices with broken screens and whether they give a disposal receipt.',
        ],
        confidence: 'medium',
        limitations: ['Collection points and take-back options vary by city, so check what is available near you.'],
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Won't power on
// ---------------------------------------------------------------------------

export function deadTurn(c: ScriptContext): AssistantTurn {
  const { facts } = c;
  const noun = facts.deviceNoun;
  if (facts.water === undefined && canAsk(c)) {
    return gather(
      `${photoHint(c)}Sorry your ${noun} won't turn on. I can't see inside it, so a couple of quick questions will help me point you the right way.`,
      'Has it been exposed to water or another liquid, even a while ago?',
      ['Yes, it got wet', 'No, never', 'Not sure'],
    );
  }
  if (facts.age === undefined && canAsk(c)) {
    const water = facts.water === 'yes' ? 'Liquid exposure is worth knowing about. ' : facts.water === 'no' ? 'Good, that rules out one common cause. ' : '';
    return gather(`${water}One more thing and then I'll give you my suggestions for the ${noun}.`, 'Roughly how old is it?', [
      'Under 2 years',
      '2–5 years',
      'Over 5 years',
      'Not sure',
    ]);
  }

  const old = typeof facts.age === 'number' && facts.age >= 5;
  const wet = facts.water === 'yes';
  const known = [
    wet ? 'it has been exposed to liquid' : facts.water === 'no' ? 'it has not been near liquid' : null,
    typeof facts.age === 'number' ? `it is ${ageText(facts.age)}` : null,
  ].filter(Boolean);
  const reason =
    `Since your ${noun} won't turn on${known.length ? ` and ${known.join(' and ')}` : ''}, the cause could be something small like the charging parts or something bigger. ` +
    (wet ? 'Liquid damage can keep spreading, so it is best looked at soon. ' : '') +
    (old ? 'At that age, repair is less likely to be worthwhile, but a diagnosis is the only way to know.' : 'A diagnosis is the only way to know what is wrong before deciding.');
  const limitations = [
    "I can't see inside the device, so I can't say what has failed.",
    'Whether repair is worth it depends on the diagnosis and quote, which I cannot predict.',
  ];
  if (facts.water === undefined || facts.water === 'unknown') limitations.push("I don't know whether it has been exposed to liquid.");
  if (facts.age === undefined || facts.age === 'unknown') limitations.push("I don't know how old it is.");
  limitations.push('A device that will not turn on cannot be factory reset, so your data may still be on it.');

  return recommend(
    `Here's what I'd suggest for the ${noun} that won't turn on. The first step is a professional diagnosis, with recycling as the fallback if repair isn't worth it.`,
    [
      {
        action: 'repair',
        rank: 1,
        title: 'Get a professional diagnosis',
        reason,
        nextSteps: [
          wet
            ? 'Do not keep trying to switch it on or charge it, because that can make liquid damage worse.'
            : 'Try a different charger and a different socket once, then stop if nothing changes.',
          'Ask an authorised service centre or a qualified repair shop for a diagnosis, and say whether it has been wet.',
          'Ask for the diagnosis and quote in writing before agreeing to any work.',
          'Ask whether your data can be recovered or backed up first, and what warranty the repair carries.',
        ],
        confidence: wet || old || facts.age === undefined || facts.age === 'unknown' ? 'low' : 'medium',
        limitations,
      },
      {
        action: 'recycle',
        rank: 2,
        title: 'Recycle it if repair is not worth it',
        reason: `If the diagnosis shows ${old ? 'an old device' : 'the fix'} is not worth paying for, an authorised e-waste channel is the responsible way to let it go.`,
        nextSteps: [
          'Remove the SIM card and any memory card, if there are any.',
          'Ask the recycler how they handle data on devices that cannot be wiped.',
          'Use a CPCB-authorised recycler or the maker\'s take-back programme rather than an informal scrap dealer.',
        ],
        confidence: 'medium',
        limitations: ['Collection points and take-back options vary by city, so check what is available near you.'],
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Swollen battery
// ---------------------------------------------------------------------------

export function swollenTurn(c: ScriptContext, intro = ''): AssistantTurn {
  const noun = c.facts.deviceNoun;
  return recommend(
    `${intro}${photoHint(c)}This could be a battery problem, and that comes before any other decision. Please stop using and charging your ${noun} now. The safe next steps are simple, and a technician needs to look at the battery, not you.`,
    [
      {
        action: 'stop_use',
        rank: 1,
        title: 'Stop using it and keep it safe',
        reason: `Signs that can go with a swollen or overheating battery came up, such as bulging, heat or a raised back panel. That can be a fire risk, so safety comes before repair or resale.`,
        nextSteps: [
          'Switch the device off if you can do so safely, and unplug it. Do not charge it again.',
          "Do not press on, puncture or try to remove the battery yourself.",
          'Keep it on a hard surface away from anything flammable, not in a bag, bed or sofa.',
          'Take it to a qualified repair shop or an authorised service centre, and tell them about the battery before you hand it over.',
          'If it gets hot, smokes or smells of burning, move away from it and call your local emergency number.',
        ],
        confidence: 'high',
        limitations: ["I can't confirm a battery fault from words or a photo; a technician needs to check it in person."],
      },
      {
        action: 'recycle',
        rank: 2,
        title: 'Take it to a qualified recycler',
        reason: 'If the battery is confirmed to be damaged, an authorised e-waste collection point can handle it more safely than household waste.',
        nextSteps: [
          'Call ahead and say the battery is swollen, because some collection points need to handle those separately.',
          "Use a CPCB-authorised recycler or the maker's take-back programme, not household waste or a scrap dealer.",
          'Carry it on its own in a sturdy container, away from other items.',
        ],
        confidence: 'medium',
        limitations: ['Which collection points accept damaged batteries varies by city, so check before you travel.'],
      },
    ],
  );
}

// ---------------------------------------------------------------------------
// Working old device
// ---------------------------------------------------------------------------

export function workingTurn(c: ScriptContext): AssistantTurn {
  const { facts } = c;
  const noun = facts.deviceNoun;
  if (facts.condition === undefined && canAsk(c)) {
    return gather(
      `${photoHint(c)}Let's find the best next chapter for your ${noun}. If it still works, a second life should be possible, and its condition decides which route fits best.`,
      'How would you describe its condition: like new, normal wear, or rough?',
      ['Like new', 'Some normal wear', 'Quite worn or damaged', 'Not sure'],
    );
  }

  const cond = facts.condition ?? 'unknown';
  const condText =
    cond === 'good' ? 'in very good condition' : cond === 'ok' ? 'with normal wear' : cond === 'worn' ? 'fairly worn' : 'in a condition you are not sure about';
  const ageNote = typeof facts.age === 'number' ? ` and ${ageText(facts.age)}` : '';
  const oldDevice = typeof facts.age === 'number' && facts.age >= 5;
  const secLimit = oldDevice ? ['An older device may no longer get security updates, which matters for anyone using it online.'] : [];

  const recs: Recommendation[] = [
    {
      action: 'donate',
      rank: 1,
      title: 'Donate it to someone who can use it',
      reason: `A working ${noun} that is ${condText}${ageNote} can be useful to someone else, and donating keeps it in use.`,
      nextSteps: [...WIPE_STEPS, 'Pick a reputable charity or community programme and check which devices they accept before you drop it off.'],
      confidence: cond === 'worn' || cond === 'unknown' ? 'medium' : 'high',
      limitations: ['Programmes differ in what they accept and how they handle devices, so check with them first.', ...secLimit],
    },
    {
      action: 'resell',
      rank: 2,
      title: 'Sell or trade it in',
      reason: `If you would rather get something back, a working ${noun} ${condText} may interest buyers or trade-in programmes.`,
      nextSteps: [...WIPE_STEPS, 'Compare a few buyers or trade-in offers. What you get depends on the model, age and condition.'],
      confidence: cond === 'good' || cond === 'ok' ? 'medium' : 'low',
      limitations: ['I cannot estimate what it is worth; the offers you get will tell you.'],
    },
  ];
  if (cond !== 'worn') {
    recs.push({
      action: 'reuse',
      rank: 3,
      title: 'Give it a second job at home',
      reason: `A working ${noun} can serve as a spare, or for a simple job such as music, reading or a video-call screen.`,
      nextSteps: [
        'Pick one simple job for it and set it up fresh after a factory reset.',
        'Keep it updated, or only use it for offline tasks if it no longer gets updates.',
        'Keep it somewhere safe and ventilated, and stop using it if it gets unusually hot.',
      ],
      confidence: 'medium',
      limitations: ['This only makes sense if you will really use it; otherwise donating is the better choice.', ...secLimit],
    });
  }
  return recommend(
    `Assuming your ${noun} still works, I'd give it another owner before thinking about recycling. Donating comes first, with selling it as the alternative. Please wipe your data whichever you choose.`,
    recs,
  );
}

// ---------------------------------------------------------------------------
// Fallback
// ---------------------------------------------------------------------------

export const FALLBACK_QUESTION = "What kind of device is it, and what's going on with it?";

export function fallbackQuestionTurn(c: ScriptContext): AssistantTurn {
  const known = c.facts.deviceKnown ? ` I can tell it's a ${c.facts.deviceNoun}.` : '';
  return gather(
    `Happy to help you decide what to do with it.${known} I don't have enough yet to say which route fits.`,
    FALLBACK_QUESTION,
    ['My screen is cracked', "It won't turn on", 'The battery looks swollen', "It works, I just don't use it"],
  );
}

// ---------------------------------------------------------------------------
// Follow-up answers after a recommendation
// ---------------------------------------------------------------------------

const follow = (message: string, quickReplies: string[]): AssistantTurn => ({
  stage: 'follow_up',
  message,
  followUpQuestion: null,
  quickReplies,
  recommendations: [],
  safetyWarnings: [],
});

const COST_TEXT: Record<Recommendation['action'], string> = {
  repair:
    "I can't quote repair costs. They depend on your model, which part has failed, and the parts and labour where you live. Ask an authorised service centre and an independent shop for written quotes, then compare them with what a similar used device would cost.",
  resell:
    "I can't give prices. What you'd get depends on the model, its age and condition, and what buyers want right now. Get offers from a few buyers or trade-in programmes and compare them.",
  recycle:
    'Recycling is about getting it to the right place, not its value. Whether a collection point or take-back programme charges anything varies, so ask before you go.',
  donate:
    "Donating isn't about price. What matters is whether the group accepts your model and condition, so check what they take before you drop it off.",
  reuse: 'Reusing it at home costs nothing to decide on; the real question is whether you will use it. Try it for a week before committing to another plan.',
  stop_use: "Cost isn't the issue yet. Safety comes first, and the technician or recycler can tell you if anything is payable once they have seen it.",
};

const WHERE_TEXT =
  "The links under the recommendation cards are a good place to start, but check them yourself because I can't vouch for what is available near you. For a recycler, ask whether they are CPCB-authorised under the e-waste rules and whether they give you a disposal receipt. For repairs, an authorised service centre can be found through the maker's own support page.";

const WIPE_TEXT = `Before it leaves your hands: ${WIPE_STEPS.map((s, i) => `${i + 1}) ${s.replace(/\.$/, '')}`).join('; ')}. If it will not switch on, ask the recycler how they handle data.`;

const WHY_QUICK = ['What affects the cost?', 'How do I wipe my data?', 'Where can I take it?', 'Why this first?'];

export function followUpTurn(topAction: Recommendation['action'], top: Recommendation | undefined, message: string): AssistantTurn {
  const m = message.toLowerCase();
  const reply = (text: string, skip: number) => follow(text, WHY_QUICK.filter((_, i) => i !== skip).slice(0, 3));
  if (/price|cost|worth|how much|value|\bfees?\b|\bcharges?\b/.test(m)) return reply(COST_TEXT[topAction], 0);
  if (/wipe|back ?up|reset|erase|delete|data|privacy|sign out|\bsim\b/.test(m)) return reply(WIPE_TEXT, 1);
  if (/where|near me|nearby|nearest|recycler|shop|cent(?:re|er)|drop|collection|authori[sz]ed/.test(m)) return reply(WHERE_TEXT, 2);
  if (/why|sure|confiden|certain|reason|explain|how come/.test(m)) {
    const limit = top?.limitations[0] ? ` One caveat: ${top.limitations[0]}` : '';
    return reply(`My reasoning for putting "${top?.title ?? 'that option'}" first: ${top?.reason ?? 'it fits what you told me best.'}${limit}`, 3);
  }
  const step = top?.nextSteps[0] ? ` A good first step: ${top.nextSteps[0]}` : '';
  return reply(`Staying with my top suggestion, "${top?.title ?? 'the first option'}".${step} You can also ask about cost, wiping your data, where to take it, or why I ranked it first.`, -1);
}
