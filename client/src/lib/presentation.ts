import type { Component } from 'vue';
import { Clock, HeartHandshake, OctagonAlert, Recycle, RefreshCw, Tag, Wrench } from '@lucide/vue';
import type {
  Action,
  ChatResponse,
  Confidence,
  HealthResponse,
  OutcomeValue,
  Recommendation,
  Resource,
} from '../../../shared/schemas';

export interface ActionStyle {
  label: string;
  icon: Component;
  /** Icon tile: background + foreground. */
  tile: string;
  /** Soft surface for the primary card header. */
  surface: string;
  border: string;
  /** Accent text colour. */
  text: string;
  /** Solid accent (step numbers). */
  solid: string;
}

// Full class strings (never interpolated) so Tailwind can see them at build time.
export const ACTION_STYLES: Record<Action, ActionStyle> = {
  repair: {
    label: 'Repair',
    icon: Wrench,
    tile: 'bg-sky-100 text-sky-700',
    surface: 'bg-sky-50',
    border: 'border-sky-200',
    text: 'text-sky-700',
    solid: 'bg-sky-700 text-white',
  },
  reuse: {
    label: 'Reuse',
    icon: RefreshCw,
    tile: 'bg-indigo-100 text-indigo-700',
    surface: 'bg-indigo-50',
    border: 'border-indigo-200',
    text: 'text-indigo-700',
    solid: 'bg-indigo-700 text-white',
  },
  // Kept clear of red/rose so it never reads like a warning.
  donate: {
    label: 'Donate',
    icon: HeartHandshake,
    tile: 'bg-violet-100 text-violet-700',
    surface: 'bg-violet-50',
    border: 'border-violet-200',
    text: 'text-violet-700',
    solid: 'bg-violet-700 text-white',
  },
  resell: {
    label: 'Resell',
    icon: Tag,
    tile: 'bg-amber-100 text-amber-800',
    surface: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-800',
    solid: 'bg-amber-700 text-white',
  },
  recycle: {
    label: 'Recycle',
    icon: Recycle,
    tile: 'bg-emerald-100 text-emerald-700',
    surface: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    solid: 'bg-emerald-700 text-white',
  },
  // Urgent: solid red tile and a stronger border so it never reads as "just another option".
  stop_use: {
    label: 'Stop using it',
    icon: OctagonAlert,
    tile: 'bg-red-600 text-white shadow-sm shadow-red-900/20',
    surface: 'bg-red-50',
    border: 'border-red-300',
    text: 'text-red-700',
    solid: 'bg-red-600 text-white',
  },
};

export const CONFIDENCE_META: Record<Confidence, { label: string; level: number; pill: string }> = {
  high: { label: 'High confidence', level: 3, pill: 'bg-emerald-50 text-emerald-800 ring-emerald-200' },
  medium: { label: 'Medium confidence', level: 2, pill: 'bg-stone-100 text-stone-700 ring-stone-200' },
  low: { label: 'Low confidence', level: 1, pill: 'bg-stone-100 text-stone-600 ring-stone-200' },
};

export interface OutcomeOption {
  value: OutcomeValue;
  label: string;
  icon: Component;
  /**
   * Shown once the choice is recorded. Qualitative only: no per-device impact figures, since
   * we can't measure them. Absent for "Still deciding".
   */
  celebration?: { title: string; body: string; impact: string[]; reminder?: string };
}

/** Source for the one global figure we quote (62 Mt of e-waste in 2022, under a quarter properly recycled). */
export const EWASTE_MONITOR_URL = 'https://ewastemonitor.info/the-global-e-waste-monitor-2024/';

const DATA_REMINDER =
  'Before you hand it over: back up, sign out of your accounts, remove the SIM and memory card, and factory reset.';

export const OUTCOME_OPTIONS: OutcomeOption[] = [
  {
    value: 'repaired',
    label: 'Repair it',
    icon: Wrench,
    celebration: {
      title: 'Repairing it is a win for the planet',
      body: 'Fixing what you already own is one of the most sustainable choices there is.',
      impact: [
        'Nothing new has to be made to replace it',
        'Its battery, metals and plastics stay out of landfill',
        'Repair often costs less than buying new',
      ],
      reminder: 'Back up your data before you hand it in for repair.',
    },
  },
  {
    value: 'reused',
    label: 'Reuse it',
    icon: RefreshCw,
    celebration: {
      title: 'A new job for your device, a break for the planet',
      body: 'Giving an old device a fresh purpose keeps it useful and out of the drawer.',
      impact: [
        'It does a useful job instead of gathering dust',
        'You may not need to buy a new gadget for that job',
        'Its materials stay out of landfill for longer',
      ],
    },
  },
  {
    value: 'donated',
    label: 'Donate it',
    icon: HeartHandshake,
    celebration: {
      title: 'A kind choice — for someone else and for the planet',
      body: 'Your device gets a second life with someone who needs it.',
      impact: [
        'Someone who needs a device gets one',
        'It could help a student learn or a family stay connected',
        'It stays in use instead of becoming e-waste',
      ],
      reminder: DATA_REMINDER,
    },
  },
  {
    value: 'sold',
    label: 'Sell it',
    icon: Tag,
    celebration: {
      title: 'Off to a new owner, and out of the landfill',
      body: 'Selling keeps a working device earning its keep instead of gathering dust.',
      impact: [
        'A working device stays in use for longer',
        'Its next owner may not need to buy a new one',
        'You get some money back for it',
      ],
      reminder: DATA_REMINDER,
    },
  },
  {
    value: 'recycled',
    label: 'Recycle it',
    icon: Recycle,
    celebration: {
      title: 'You’re doing your part for the planet',
      body: 'An authorised recycler will recover what’s valuable and handle what’s hazardous safely.',
      impact: [
        'Copper, gold and other metals inside can be recovered and reused',
        'Less new metal has to be mined',
        'Hazardous parts like the battery are handled safely, not dumped',
      ],
      reminder: 'Remove the SIM and memory card first, and wipe it if it still turns on.',
    },
  },
  { value: 'undecided', label: 'Still deciding', icon: Clock },
];

const ACTION_OUTCOME: Record<Action, OutcomeValue> = {
  repair: 'repaired',
  reuse: 'reused',
  donate: 'donated',
  resell: 'sold',
  recycle: 'recycled',
  stop_use: 'recycled',
};

/** Outcome options with the recommended ones first (by rank); "Still deciding" always last. */
export function orderedOutcomes(recommendations: Recommendation[]): OutcomeOption[] {
  const preferred = byRank(recommendations).map((r) => ACTION_OUTCOME[r.action]);
  const order = [...new Set([...preferred, ...OUTCOME_OPTIONS.map((o) => o.value)])].filter((v) => v !== 'undecided');
  const options = order.map((v) => OUTCOME_OPTIONS.find((o) => o.value === v)!);
  return [...options, OUTCOME_OPTIONS.find((o) => o.value === 'undecided')!];
}

export function byRank(recommendations: Recommendation[]): Recommendation[] {
  return [...recommendations].sort((a, b) => a.rank - b.rank);
}

export const MAX_RESOURCES_PER_CARD = 3;

/**
 * Each resource appears once, under the highest-ranked recommendation whose action it
 * supports (at most three per card). Anything that fits no recommendation is returned
 * separately so it can still be shown.
 */
export function assignResources(
  recommendations: Recommendation[],
  resources: Resource[],
): { byRank: Map<number, Resource[]>; unassigned: Resource[] } {
  const ranked = byRank(recommendations);
  const map = new Map<number, Resource[]>(ranked.map((r) => [r.rank, []]));
  const unassigned: Resource[] = [];
  const seen = new Set<string>();

  for (const resource of resources) {
    if (seen.has(resource.id)) continue;
    seen.add(resource.id);
    const home = ranked.find(
      (r) => resource.actions.includes(r.action) && (map.get(r.rank)?.length ?? 0) < MAX_RESOURCES_PER_CARD,
    );
    if (home) map.get(home.rank)!.push(resource);
    else if (!ranked.some((r) => resource.actions.includes(r.action))) unassigned.push(resource);
  }
  return { byRank: map, unassigned: unassigned.slice(0, MAX_RESOURCES_PER_CARD) };
}

export function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// Mode badge
// ---------------------------------------------------------------------------

export type BadgeTone = 'checking' | 'demo' | 'live' | 'offline';

export interface ModeBadgeState {
  tone: BadgeTone;
  label: string;
  /** Narrow-screen label (phones), e.g. just the model name. */
  short: string;
  /** Longer explanation for the tooltip and screen readers. */
  detail: string;
}

const DEMO_BADGE: ModeBadgeState = {
  tone: 'demo',
  label: 'Demo mode',
  short: 'Demo mode',
  detail: 'Demo mode: replies come from scripted examples, not a live AI model.',
};

export function badgeFromProviders(providers: ChatResponse['providers']): ModeBadgeState {
  const { assessment, segmentation } = providers;
  if (assessment.isMock && segmentation.isMock) return DEMO_BADGE;
  const label = `Powered by ${assessment.name}${segmentation.isMock ? '' : ` + ${segmentation.name}`}`;
  const detail = `Replies are generated by ${assessment.name}${segmentation.isMock ? '' : `; photo highlights by ${segmentation.name}`}.`;
  return { tone: 'live', label, short: assessment.name, detail };
}

export function badgeFromHealth(health: HealthResponse): ModeBadgeState {
  if (health.isMock) return DEMO_BADGE;
  return {
    tone: 'live',
    label: `Powered by ${health.provider}`,
    short: health.provider,
    detail: `Replies are generated by ${health.provider}.`,
  };
}

export const CHECKING_BADGE: ModeBadgeState = {
  tone: 'checking',
  label: 'Connecting…',
  short: 'Connecting…',
  detail: 'Checking the connection to SecondLife AI.',
};

export const OFFLINE_BADGE: ModeBadgeState = {
  tone: 'offline',
  label: 'Offline',
  short: 'Offline',
  detail: 'Can’t reach SecondLife AI right now. You can still try sending a message.',
};
