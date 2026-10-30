import { z } from 'zod';
import { ResourceSchema, type Action, type Resource } from '../../../shared/schemas';
import resourcesJson from '../data/resources.json';

const MAX_PER_ACTION = 3;

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

/** Up to three entries per action, in the order of the actions, without duplicates. */
export function resourcesForActions(actions: Action[], region: string): Resource[] {
  const out: Resource[] = [];
  for (const action of actions) {
    const matches = forRegion(resources.filter((r) => r.actions.includes(action)), region).slice(0, MAX_PER_ACTION);
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
