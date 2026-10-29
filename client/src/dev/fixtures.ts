// Dev-only fixture conversations (loaded from main.ts behind `import.meta.env.DEV` and `?fixtures`),
// so every stage and card can be reviewed without the API. Never part of the production bundle.
//   ?fixtures          cracked phone: gathering + overlay, recommending, follow_up, failed message
//   ?fixtures=battery  swollen battery: stop_use first, safety banner, recycler links
//   ?fixtures=tablet   working tablet: donate first, privacy reminder, outcome already recorded
import type { ChatResponse, DamageRegion, Resource } from '../../../shared/schemas';
import { useConversation, type Entry, type Photo } from '../composables/useConversation';
import { ApiError } from '../lib/api';

type Point = [number, number];

const MOCK_PROVIDERS: ChatResponse['providers'] = {
  assessment: { name: 'mock', isMock: true },
  segmentation: { name: 'mock', isMock: true },
};

// ---------------------------------------------------------------------------
// A drawn "photo" of a cracked phone. The damage polygons are derived from the same
// geometry that draws the cracks, so any misalignment in the overlay is obvious.
// ---------------------------------------------------------------------------

const W = 1200;
const H = 1600;
const IMPACT: Point = [640, 560];
const CRACKS: Point[][] = [
  [IMPACT, [600, 500], [578, 430], [540, 372], [500, 300]],
  [IMPACT, [700, 522], [762, 470], [820, 432], [858, 402]],
  [IMPACT, [612, 640], [560, 720], [522, 830], [470, 940], [432, 1012]],
  [IMPACT, [702, 640], [742, 760], [792, 862], [842, 962]],
  [IMPACT, [560, 582], [470, 612], [382, 640], [346, 652]],
];
const CORNER_CENTRE: Point = [810, 1330]; // centre of the phone's bottom-right corner radius
const CORNER_RADIUS = 90;

/** Thin tapering polygon around a polyline, like a segmentation mask of a crack. */
function strokePolygon(line: Point[], halfWidth: number): Point[] {
  const left: Point[] = [];
  const right: Point[] = [];
  line.forEach((p, i) => {
    const prev = line[Math.max(0, i - 1)]!;
    const next = line[Math.min(line.length - 1, i + 1)]!;
    const dx = next[0] - prev[0];
    const dy = next[1] - prev[1];
    const len = Math.hypot(dx, dy) || 1;
    const w = halfWidth * (1 - (0.6 * i) / (line.length - 1));
    const nx = (-dy / len) * w;
    const ny = (dx / len) * w;
    left.push([Math.round(p[0] + nx), Math.round(p[1] + ny)]);
    right.push([Math.round(p[0] - nx), Math.round(p[1] - ny)]);
  });
  return [...left, ...right.reverse()];
}

function arcPoint(radius: number, deg: number): Point {
  const a = (deg * Math.PI) / 180;
  return [Math.round(CORNER_CENTRE[0] + radius * Math.cos(a)), Math.round(CORNER_CENTRE[1] + radius * Math.sin(a))];
}

function cornerPolygon(): Point[] {
  const outer: Point[] = [];
  const inner: Point[] = [];
  for (let deg = 8; deg <= 82; deg += 6) {
    outer.push(arcPoint(CORNER_RADIUS + 10, deg));
    inner.push(arcPoint(CORNER_RADIUS - 26, deg));
  }
  return [...outer, ...inner.reverse()];
}

async function drawCrackedPhoto(): Promise<{ photo: Photo; regions: DamageRegion[] }> {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // Table top
  const wood = ctx.createLinearGradient(0, 0, W, H);
  wood.addColorStop(0, '#d9c4a3');
  wood.addColorStop(1, '#b2926a');
  ctx.fillStyle = wood;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120, 90, 50, 0.12)';
  ctx.lineWidth = 3;
  for (let y = 40; y < H; y += 46) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(W * 0.3, y + 18, W * 0.7, y - 18, W, y + 6);
    ctx.stroke();
  }

  // Phone body
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.35)';
  ctx.shadowBlur = 50;
  ctx.shadowOffsetY = 24;
  ctx.fillStyle = '#1c1917';
  ctx.beginPath();
  ctx.roundRect(300, 180, 600, 1240, CORNER_RADIUS);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#57534e';
  ctx.lineWidth = 4;
  ctx.stroke();

  // Screen
  const screen = ctx.createLinearGradient(330, 250, 870, 1350);
  screen.addColorStop(0, '#1e3a5f');
  screen.addColorStop(1, '#0b1220');
  ctx.fillStyle = screen;
  ctx.beginPath();
  ctx.roundRect(330, 250, 540, 1100, 48);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.moveTo(330, 900);
  ctx.lineTo(870, 420);
  ctx.lineTo(870, 620);
  ctx.lineTo(330, 1100);
  ctx.fill();
  ctx.fillStyle = '#0c0a09';
  ctx.beginPath();
  ctx.arc(600, 216, 11, 0, Math.PI * 2);
  ctx.fill();

  // Cracks
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of CRACKS) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    line.forEach(([x, y], i) => (i ? ctx.lineTo(x + 5, y + 4) : ctx.moveTo(x + 5, y + 4)));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.arc(IMPACT[0], IMPACT[1], 16, 0, Math.PI * 2);
  ctx.fill();

  // Scuffed, dented corner
  ctx.strokeStyle = '#a8a29e';
  ctx.lineWidth = 7;
  ctx.setLineDash([22, 9, 8, 12]);
  ctx.beginPath();
  ctx.arc(CORNER_CENTRE[0], CORNER_CENTRE[1], CORNER_RADIUS - 6, (12 * Math.PI) / 180, (78 * Math.PI) / 180);
  ctx.stroke();
  ctx.setLineDash([]);

  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85));
  return {
    photo: { url: URL.createObjectURL(blob), width: W, height: H },
    regions: [
      { concept: 'screen crack', polygons: CRACKS.map((line) => strokePolygon(line, 16)), score: 0.91 },
      { concept: 'dented corner', polygons: [cornerPolygon()], score: 0.74 },
    ],
  };
}

// ---------------------------------------------------------------------------
// Resources: real entries from the curated list, plus one web-found example.
// ---------------------------------------------------------------------------

function curated(id: string, name: string, url: string, region: string, actions: Resource['actions'], description: string): Resource {
  return { id, name, url, region, actions, description, source: 'curated', citationUrl: null, lastVerified: null };
}

const R = {
  ifixit: curated(
    'ifixit',
    'iFixit',
    'https://www.ifixit.com/',
    'global',
    ['repair'],
    'Free, community-written repair guides for phones, laptops and other electronics, plus repair parts and tools and a community forum.',
  ),
  samsungService: curated(
    'samsung-india-service-centre',
    'Samsung India - Find a Service Center',
    'https://www.samsung.com/in/support/service-center/',
    'IN',
    ['repair', 'stop_use'],
    'Samsung India’s official locator: choose a product category, enter a city, town or postcode and a search radius to find the nearest service centre.',
  ),
  cashify: curated(
    'cashify',
    'Cashify',
    'https://www.cashify.in/',
    'IN',
    ['resell'],
    'Indian platform to sell used phones, laptops, tablets, smartwatches and other gadgets; also sells refurbished devices.',
  ),
  karoSambhav: curated(
    'karo-sambhav-collection-centres',
    'Karo Sambhav - E-Waste Collection Centres',
    'https://www.karosambhav.com/collection-centres',
    'IN',
    ['recycle', 'stop_use'],
    'Producer responsibility organisation listing e-waste collection centres in several states; accepts items such as laptops, printers and mobile phones.',
  ),
  samsungTakeback: curated(
    'samsung-india-ewaste-takeback',
    'Samsung India - E-Waste Take-back and Recycling',
    'https://www.samsung.com/in/microsite/takeback-recycling/',
    'IN',
    ['recycle', 'stop_use'],
    'Samsung India’s programme to recycle old products via authorised recyclers; pick-up can be requested by WhatsApp.',
  ),
  cpcb: curated(
    'cpcb-e-waste',
    'CPCB - E-Waste Management',
    'https://cpcb.gov.in/e-waste-management/',
    'IN',
    ['recycle', 'stop_use'],
    'India’s Central Pollution Control Board e-waste section: E-Waste (Management) Rules, FAQs and technical guidelines.',
  ),
  appleRecycling: curated(
    'apple-india-recycling',
    'Apple India - Recycling',
    'https://www.apple.com/in/recycling/',
    'IN',
    ['recycle', 'stop_use'],
    'Apple’s India recycling page: devices you no longer use can be recycled, with links to the Apple Trade In and recycling programme pages.',
  ),
  androidReset: curated(
    'google-android-factory-reset',
    'Google - Reset your Android device to factory settings',
    'https://support.google.com/android/answer/6088915',
    'global',
    ['donate', 'resell'],
    'Android Help guide to backing up data and factory resetting an Android phone, including what you need before you start.',
  ),
  merabyte: curated(
    'def-merabyte',
    'Digital Empowerment Foundation - MeraByte device donation',
    'https://defindia.org/merabyte/',
    'IN',
    ['donate'],
    'DEF collects old but functional mobile phones, tablets, laptops and other digital devices from individuals for rural communities.',
  ),
  webScreenGuides: {
    id: 'web-ifixit-phone',
    name: 'Phone repair guides — iFixit',
    url: 'https://www.ifixit.com/Device/Phone',
    region: 'global',
    actions: ['repair'],
    description: 'Step-by-step screen and battery replacement guides for popular phone models, with difficulty ratings.',
    source: 'web',
    citationUrl: 'https://www.ifixit.com/Device/Phone',
    lastVerified: null,
  } satisfies Resource,
};

// ---------------------------------------------------------------------------
// Conversations
// ---------------------------------------------------------------------------

let n = 0;
const id = (p: string) => `${p}-fixture-${++n}`;

function user(text: string, photo: Photo | null = null): Entry {
  return { kind: 'user', id: id('u'), text, photo, file: null, status: 'sent', error: null };
}

function assistant(
  turn: Partial<ChatResponse['turn']> & Pick<ChatResponse['turn'], 'stage' | 'message'>,
  extra: Partial<Omit<ChatResponse, 'turn'>> = {},
  photo: Photo | null = null,
): Entry {
  const response: ChatResponse = {
    conversationId: 'fixture',
    turn: { followUpQuestion: null, quickReplies: [], recommendations: [], safetyWarnings: [], ...turn },
    resources: [],
    damageRegions: [],
    providers: MOCK_PROVIDERS,
    imageAnalysed: !!photo,
    ...extra,
  };
  return { kind: 'assistant', id: id('a'), response, photo };
}

async function cracked(): Promise<Entry[]> {
  const { photo, regions } = await drawCrackedPhoto();
  const failed: Entry = {
    kind: 'user',
    id: id('u'),
    text: 'How do I back up my phone first?',
    photo: null,
    file: null,
    status: 'failed',
    error: new ApiError('PROVIDER_TIMEOUT', 'The assistant took too long to reply. Please try again.', 504),
  };
  return [
    user('What can I do with this?', photo),
    assistant(
      {
        stage: 'gathering',
        message:
          'Thanks for the photo. I can see a smartphone with a cracked screen — the cracks spread out from one impact point near the top — and some wear on the bottom corner. This is a first look from the photo, not a diagnosis.',
        followUpQuestion: 'Does the touchscreen still respond everywhere, including over the cracked area?',
        quickReplies: ['Yes, touch works fine', 'Only in some places', 'No, it doesn’t respond'],
      },
      { damageRegions: regions },
      photo,
    ),
    user('Yes, touch works fine'),
    assistant({
      stage: 'recommending',
      message:
        'Good news — if touch still works, the damage is most likely limited to the glass. Here’s what I’d suggest, best option first.',
      safetyWarnings: [
        'Cracked glass can splinter. Cover the screen with clear tape and avoid pressing on the cracked area until it’s repaired.',
      ],
      recommendations: [
        {
          action: 'repair',
          rank: 1,
          title: 'Get the screen replaced',
          reason:
            'Touch still works and there are no signs of other damage, so a screen replacement should restore the phone fully — and keep a working device in use for longer.',
          nextSteps: [
            'Back up your phone now, in case the screen gets worse.',
            'Get a written quote from an authorised service centre and from one or two well-reviewed local repair shops.',
            'Ask whether the replacement is an original or compatible part, and what warranty comes with it.',
            'Compare the quote with what the phone is worth to you before going ahead.',
          ],
          confidence: 'high',
          limitations: [
            'I can’t see damage under the glass, such as to the display panel or frame.',
            'The cost depends on the model and the part used — a quote will tell you.',
          ],
        },
        {
          action: 'resell',
          rank: 2,
          title: 'Sell it as-is',
          reason: 'If you’d rather upgrade, a working phone with a cracked screen can still be sold for parts or refurbishment.',
          nextSteps: [
            'Check a few resale platforms and note how they grade cracked screens.',
            'Describe the crack honestly in your listing.',
            'Wipe your data before handing it over.',
          ],
          confidence: 'medium',
          limitations: ['Offers vary with the model, age and condition — compare a few before deciding.'],
        },
        {
          action: 'recycle',
          rank: 3,
          title: 'Recycle it responsibly',
          reason: 'If repair isn’t worth it and it won’t sell, an authorised e-waste collector will recover its materials safely.',
          nextSteps: ['Find an authorised e-waste collection point near you.', 'Wipe your data and remove the SIM first.'],
          confidence: 'medium',
          limitations: [],
        },
      ],
    }, {
      resources: [R.ifixit, R.webScreenGuides, R.samsungService, R.cashify, R.karoSambhav, R.cpcb],
    }),
    user('Will repairing it erase my data?'),
    assistant({
      stage: 'follow_up',
      message:
        'Usually not — a screen replacement doesn’t touch the phone’s storage. Still, back up first: repair shops sometimes need to reset a phone while testing it, and a backup protects you either way. Remove your SIM and memory card before you hand it over.',
      quickReplies: ['How do I back up my phone first?', 'Where can I recycle it instead?'],
    }),
    failed,
  ];
}

function battery(): Entry[] {
  return [
    user('The back of my phone is bulging'),
    assistant({
      stage: 'recommending',
      message:
        'A bulging back usually means the battery is swelling. That can be dangerous, so please treat this as urgent — here’s what to do.',
      safetyWarnings: [
        'Stop using and charging the device now. Don’t puncture or press on the battery, keep it away from anything flammable, and take it to a qualified repair shop or e-waste collection point.',
      ],
      recommendations: [
        {
          action: 'stop_use',
          rank: 1,
          title: 'Stop using it and hand it in safely',
          reason:
            'A swollen lithium battery can overheat or catch fire. It needs to be handled by a qualified repair shop or an authorised e-waste collector — never removed at home.',
          nextSteps: [
            'Switch the phone off and unplug it. Don’t charge it again.',
            'Keep it somewhere cool, away from anything flammable.',
            'If you can do so without pressing on the back, copy off any data you need.',
            'Take it to an authorised service centre or e-waste collection point and tell them the battery is swollen.',
          ],
          confidence: 'high',
          limitations: ['I can’t confirm the cause from a description alone; a technician can.'],
        },
        {
          action: 'recycle',
          rank: 2,
          title: 'Recycle it at an authorised e-waste centre',
          reason: 'If a repair isn’t worthwhile, an authorised recycler will dispose of the battery safely.',
          nextSteps: ['Call ahead to confirm they accept phones with swollen batteries.', 'Carry it in a non-flammable container.'],
          confidence: 'high',
          limitations: [],
        },
      ],
    }, {
      resources: [R.karoSambhav, R.samsungTakeback, R.cpcb, R.appleRecycling],
    }),
  ];
}

function tablet(): Entry[] {
  return [
    user('Still works, I just upgraded.'),
    assistant({
      stage: 'gathering',
      message: 'Great — a working device has the most options.',
      followUpQuestion: 'What kind of device is it, and what condition is it in?',
      quickReplies: ['Tablet, good condition', 'Tablet, some scratches', 'Battery doesn’t last long'],
    }),
    user('Tablet, good condition'),
    assistant({
      stage: 'recommending',
      message: 'A working tablet in good condition can make a real difference to someone else. Here are your best options.',
      recommendations: [
        {
          action: 'donate',
          rank: 1,
          title: 'Donate it to someone who needs it',
          reason:
            'It works and is in good condition, so it can be used as-is — for example by a student or a community learning centre.',
          nextSteps: [
            'Back up anything you want to keep, then sign out of your accounts.',
            'Factory reset the tablet.',
            'Contact a device-donation programme to check what they accept.',
          ],
          confidence: 'high',
          limitations: ['Donation programmes have their own conditions; check before you drop it off.'],
        },
        {
          action: 'resell',
          rank: 2,
          title: 'Sell it',
          reason: 'A working tablet in good condition usually has resale value.',
          nextSteps: ['Compare offers on a few resale platforms.', 'Wipe your data before handing it over.'],
          confidence: 'medium',
          limitations: ['Resale value depends on the model and age.'],
        },
      ],
    }, {
      resources: [R.merabyte, R.androidReset, R.cashify],
      providers: { assessment: { name: 'Muse Spark', isMock: false }, segmentation: { name: 'SAM 3', isMock: false } },
    }),
  ];
}

export async function loadFixtures(name: string) {
  const conversation = useConversation();
  const entries = name === 'battery' ? battery() : name === 'tablet' ? tablet() : await cracked();
  conversation.reset();
  conversation.entries.value = entries;
  conversation.conversationId.value = 'fixture';
  if (name === 'tablet') conversation.outcome.value = { recorded: 'donated', saving: null, error: null };
}
