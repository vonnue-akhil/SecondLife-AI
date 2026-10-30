// Builds client/src/data/india-places.json, the offline table the client uses to turn the device's
// position into "nearest town, district, state" without sending coordinates anywhere.
//
// Source: GeoNames (https://www.geonames.org/, CC BY 4.0). Download and unzip into one folder:
//   https://download.geonames.org/export/dump/cities5000.zip
//   https://download.geonames.org/export/dump/admin2Codes.txt
// Then run: npx tsx scripts/build-india-places.ts <that folder>
import fs from 'node:fs';
import path from 'node:path';
import type { StateCode } from '../shared/india-states';

const OUT_FILE = path.join(import.meta.dirname, '..', 'client', 'src', 'data', 'india-places.json');

// GeoNames admin1 codes for India.
const GEONAMES_STATES: Record<string, StateCode> = {
  '01': 'AN', '02': 'AP', '03': 'AS', '05': 'CH', '07': 'DL', '09': 'GJ', '10': 'HR', '11': 'HP', '12': 'JK',
  '13': 'KL', '14': 'LD', '16': 'MH', '17': 'MN', '18': 'ML', '19': 'KA', '20': 'NL', '21': 'OD', '22': 'PY',
  '23': 'PB', '24': 'RJ', '25': 'TN', '26': 'TR', '28': 'WB', '29': 'SK', '30': 'AR', '31': 'MZ', '33': 'GA',
  '34': 'BR', '35': 'MP', '36': 'UP', '37': 'CG', '38': 'JH', '39': 'UK', '40': 'TS', '41': 'LA', '52': 'DH',
};

// Sections of a city (PPLX), abandoned, historical and destroyed places would make poor labels.
const SKIPPED_FEATURES = new Set(['PPLX', 'PPLQ', 'PPLH', 'PPLW', 'PPLCH']);
const NEIGHBOURS = new Set(['PK', 'NP', 'BD', 'BT', 'LK', 'MM', 'CN', 'AF']);
/** Neighbouring towns this close to an Indian one are kept, so border areas resolve to the right country. */
const BORDER_KM = 150;
const SAFE_NAME = /^[\p{L}\p{M}\p{N} .,'()&-]+$/u;

const dir = process.argv[2];
if (!dir) {
  console.error('Usage: npx tsx scripts/build-india-places.ts <folder with cities5000.txt and admin2Codes.txt>');
  process.exit(1);
}

const rows = (file: string) =>
  fs.readFileSync(path.join(dir, file), 'utf8').split('\n').filter(Boolean).map((line) => line.split('\t'));

// "District Unnao", "Thrissur District", "Pune Division" -> "Unnao", "Thrissur", "Pune": the client adds "district".
const bareDistrict = (name: string) => name.replace(/^district\s+/i, '').replace(/\s+(district|division)$/i, '');

const districtNames = new Map<string, string>();
for (const [code, , ascii] of rows('admin2Codes.txt')) {
  if (code?.startsWith('IN.') && ascii) districtNames.set(code, bareDistrict(ascii));
}

const round = (n: number) => Math.round(n * 100) / 100;
const districts: string[] = [];
const places: [string, StateCode, number, number, number][] = [];
const neighbours: [number, number][] = [];

for (const r of rows('cities5000.txt')) {
  const [, , ascii, , lat, lng, , feature, country, , admin1, admin2] = r;
  if (!ascii || !lat || !lng || !feature || SKIPPED_FEATURES.has(feature)) continue;
  if (country === 'IN') {
    const state = GEONAMES_STATES[admin1 ?? ''];
    if (!state || !SAFE_NAME.test(ascii)) {
      console.warn(`skipped ${ascii} (admin1 ${admin1})`);
      continue;
    }
    const district = districtNames.get(`IN.${admin1}.${admin2}`);
    let districtIndex = -1;
    if (district && SAFE_NAME.test(district)) {
      districtIndex = districts.indexOf(district);
      if (districtIndex === -1) districtIndex = districts.push(district) - 1;
    }
    places.push([ascii, state, districtIndex, round(Number(lat)), round(Number(lng))]);
  } else if (country && NEIGHBOURS.has(country)) {
    neighbours.push([round(Number(lat)), round(Number(lng))]);
  }
}

const km = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const x = (bLng - aLng) * Math.cos(((aLat + bLat) / 2) * (Math.PI / 180));
  return Math.hypot(x, bLat - aLat) * 111.2;
};
const nearIndia = neighbours.filter(([lat, lng]) => places.some((p) => km(lat, lng, p[3], p[4]) < BORDER_KM));

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(
  OUT_FILE,
  JSON.stringify({
    source: 'GeoNames cities5000 (https://www.geonames.org/), CC BY 4.0',
    districts,
    places, // [town, state code, index into districts or -1, lat, lng]
    outside: nearIndia, // [lat, lng] of towns in neighbouring countries near the border
  }) + '\n',
);
console.log(`Wrote ${places.length} places, ${districts.length} districts, ${nearIndia.length} border towns to ${OUT_FILE}`);
