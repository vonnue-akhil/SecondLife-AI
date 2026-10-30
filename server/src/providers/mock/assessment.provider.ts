import { MAX_FOLLOW_UP_QUESTIONS } from '../../config';
import {
  chooseScript,
  crackedTurn,
  deadTurn,
  fallbackQuestionTurn,
  followUpTurn,
  swollenTurn,
  workingTurn,
  type ScriptContext,
} from '../../data/mock-scripts';
import { findSample } from '../../data/samples';
import { detectHazard, hazardTerms } from '../../services/safety.service';
import type { Session } from '../../services/session.store';
import type { AssessmentProvider } from '../types';
import { deviceFromText, extractFacts } from './facts';

const NOTE =
  'In demo mode I can only recognise the bundled sample photos, so I can\'t read your photo; I\'ll go by what you tell me.';
const NOTE_MARKER = 'bundled sample photos';

const delay = () => new Promise((resolve) => setTimeout(resolve, 600 + Math.random() * 600));

/** True when the stored observations are the blank ones given to a photo the demo cannot recognise. */
function isUnrecognisedPhoto(s: Session): boolean {
  const o = s.observations;
  return !!o && o.confidence === 'low' && o.brandModelGuess === null && o.visibleCondition.length === 0 &&
    o.possibleHazards.length === 0 && o.damageAreas.length === 0;
}

export const mockAssessmentProvider: AssessmentProvider = {
  name: 'Scripted demo',
  isMock: true,
  supportsImages: true,
  supportsVideo: false,

  async observeVideo() {
    throw new Error('The scripted demo does not accept video');
  },

  async observeImage(image, userText) {
    const sample = findSample(image.sha256);
    if (sample) return structuredClone(sample.observations);
    const noun = deviceFromText(userText);
    return {
      deviceType: noun === 'phone' ? 'smartphone' : (noun ?? 'unknown'),
      brandModelGuess: null,
      visibleCondition: [],
      possibleHazards: [],
      damageAreas: [],
      confidence: 'low',
    };
  },

  async respond(session, userMessage) {
    await delay();
    const facts = extractFacts(session);
    const ctx: ScriptContext = {
      facts,
      observations: session.observations,
      followUpsAsked: session.followUpsAsked,
      maxFollowUps: MAX_FOLLOW_UP_QUESTIONS,
    };

    const turn = (() => {
      const last = session.lastRecommendation;
      if (last) {
        const top = last.recommendations[0];
        if (hazardTerms(userMessage).length > 0 && top?.action !== 'stop_use') {
          return swollenTurn(ctx, 'Thanks for telling me that, because it changes my advice. ');
        }
        return followUpTurn(top?.action ?? 'repair', top, userMessage);
      }
      const script = chooseScript(detectHazard(session), facts.userText, session.observations);
      switch (script) {
        case 'swollen': return swollenTurn(ctx);
        case 'cracked': return crackedTurn(ctx);
        case 'dead': return deadTurn(ctx);
        case 'working': return workingTurn(ctx);
        default:
          // Already asked what it is and still nothing matches: take the working-device path.
          return facts.asked.has('type') ? workingTurn(ctx) : fallbackQuestionTurn(ctx);
      }
    })();

    const alreadyNoted = session.messages.some((m) => m.role === 'assistant' && m.text.includes(NOTE_MARKER));
    if (isUnrecognisedPhoto(session) && !alreadyNoted) turn.message = `${NOTE} ${turn.message}`;
    return turn;
  },
};
