import { z } from 'zod';
import { ResourceSchema, type Action, type Resource } from '../../../shared/schemas';
import { DEFAULT_REGION } from '../config';
import resourcesJson from '../data/resources.json';
import type { Session } from './session.store';

const MAX_PER_ACTION = 3;

/** "IN-KL" when the user shared a state, else "IN". */
export const regionOf = (session: Session) => (session.location ? `${DEFAULT_REGION}-${session.location.state}` : DEFAULT_REGION);

// Fail fast on a malformed curated list.
const resources: Resource[] = z.array(ResourceSchema).parse(resourcesJson);

const sameRegion = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isGlobal = (r: Resource) => sameRegion(r.region, 'global');

/** "IN-KL" -> ["IN-KL", "IN"]: a state's own entries come before the country's. */
const regionChain = (region: string) => region.split('-').map((_, i, parts) => parts.slice(0, i + 1).join('-')).reverse();

/** Entries for the region (most specific first), then global ones. */
function forRegion(list: Resource[], region: string): Resource[] {
  const regional = regionChain(region).flatMap((code) => list.filter((r) => sameRegion(r.region, code)));
  return [...new Set([...regional, ...list.filter(isGlobal)])];
}

/** Brand-specific entries show only when the device's brand is known and listed. */
const fitsBrand = (r: Resource, brand: string | null) => !r.brands?.length || (brand !== null && r.brands.includes(brand));

/**
 * The device brand's own entries first, but only within the regional and the global groups: a brand's service
 * or take-back page beats a general one, without its global how-to guides pushing out Indian organisations.
 */
function brandFirst(list: Resource[]): Resource[] {
  const byBrand = (group: Resource[]) => [...group].sort((a, b) => Number(!!b.brands?.length) - Number(!!a.brands?.length));
  return [...byBrand(list.filter((r) => !isGlobal(r))), ...byBrand(list.filter(isGlobal))];
}

/** Up to three entries per action, in the order of the actions, without duplicates. */
export function resourcesForActions(actions: Action[], region: string, brand: string | null = null): Resource[] {
  const out: Resource[] = [];
  for (const action of actions) {
    const matches = brandFirst(forRegion(resources.filter((r) => r.actions.includes(action) && fitsBrand(r, brand)), region)).slice(0, MAX_PER_ACTION);
    for (const r of matches) if (!out.some((o) => o.id === r.id)) out.push(r);
  }
  return out;
}

/** For GET /resources. A region filter also includes the global entries. */
export function listResources(region?: string, action?: Action): Resource[] {
  let list = resources;
  if (action) list = list.filter((r) => r.actions.includes(action));
  if (region) list = forRegion(list, region);
  return list;
}
