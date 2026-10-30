// Detects the device's brand from the observations or the user's messages, for link filtering.
import type { Session } from './session.store';

// Lowercase brand key -> terms matched as whole words, case-insensitively, in Latin or Devanagari script.
const BRANDS: Record<string, string[]> = {
  apple: ['apple', 'iphone', 'ipad', 'macbook', 'imac', 'airpods', 'apple watch', 'ipod', 'आईफोन', 'आईफ़ोन', 'आइफोन', 'आइफ़ोन', 'एप्पल', 'ऐप्पल', 'मैकबुक'],
  samsung: ['samsung', 'galaxy', 'सैमसंग', 'गैलेक्सी'],
  // "mi" only in product forms such as "Mi 11", "Mi A3" or "Mi Note".
  xiaomi: ['xiaomi', 'redmi', 'poco', 'mi (?:\\d+\\w*|a\\d|note|max|mix|play)', 'शाओमी', 'श्याओमी', 'रेडमी', 'पोको'],
  vivo: ['vivo', 'iqoo', 'वीवो', 'विवो'],
  oppo: ['oppo', 'ओप्पो'],
  realme: ['realme', 'रियलमी'],
  oneplus: ['oneplus', 'one plus', 'वनप्लस'],
  motorola: ['motorola', 'moto', 'मोटोरोला'],
  nokia: ['nokia', 'नोकिया'],
  google: ['pixel', 'google', 'पिक्सेल', 'पिक्सल'],
  lenovo: ['lenovo', 'thinkpad', 'ideapad', 'लेनोवो'],
  hp: ['hp', 'hewlett[- ]packard', 'एचपी'],
  dell: ['dell', 'डेल'],
  asus: ['asus', 'zenbook', 'vivobook'],
  acer: ['acer'],
  microsoft: ['microsoft', 'surface (?:pro|laptop|go|book)'],
  sony: ['sony', 'playstation'],
  lg: ['lg'],
  // Common words or names, so only with a product line: "boAt Airdopes", "Noise ColorFit", "Usha fan".
  boat: ['boat (?:airdopes|rockerz|stone|bassheads|wave)'],
  noise: ['noise (?:colorfit|buds|air buds)'],
  jbl: ['jbl'],
  // TVs, home appliances and office electronics.
  whirlpool: ['whirlpool'],
  godrej: ['godrej'],
  voltas: ['voltas'],
  haier: ['haier'],
  ifb: ['ifb'],
  bajaj: ['bajaj'],
  philips: ['philips'],
  panasonic: ['panasonic'],
  havells: ['havells'],
  crompton: ['crompton'],
  daikin: ['daikin'],
  hitachi: ['hitachi'],
  bluestar: ['blue star', 'bluestar'],
  lloyd: ['lloyd'],
  tcl: ['tcl'],
  hisense: ['hisense'],
  toshiba: ['toshiba'],
  canon: ['canon'],
  epson: ['epson'],
  brother: ['brother (?:printer|hl-?\\w*|dcp-?\\w*|mfc-?\\w*)'],
  tplink: ['tp-?link'],
  usha: ['usha (?:fan|sewing machine|mixer|iron|heater|geyser)'],
  prestige: ['prestige (?:induction|mixer|cooker|kettle|iron|chimney)'],
  kent: ['kent (?:ro|water purifier)'],
};

// Whole words in any script: \b only knows ASCII letters, so Devanagari needs explicit lookarounds.
const PATTERNS = Object.entries(BRANDS).map(
  ([key, terms]) => [key, new RegExp(`(?<![\\p{L}\\p{M}\\p{N}])(?:${terms.join('|')})(?![\\p{L}\\p{M}\\p{N}])`, 'iu')] as const,
);

function match(text: string): string | null {
  return PATTERNS.find(([, re]) => re.test(text))?.[0] ?? null;
}

/** The lowercase brand key, or null when unknown. The observed guess wins over the chat. */
export function detectBrand(session: Session): string | null {
  const guess = session.observations?.brandModelGuess;
  const fromGuess = guess ? match(guess) : null;
  if (fromGuess) return fromGuess;
  for (const m of [...session.messages].reverse()) {
    if (m.role !== 'user') continue;
    const found = match(m.text);
    if (found) return found;
  }
  return null;
}
