import { bldGroup } from './bldGroup.js';

export function makePairKey(a, b, buildings) {
  const ga = bldGroup(a, buildings), gb = bldGroup(b, buildings);
  if (ga === gb) return null; // same building/composite — skip
  return Math.min(ga, gb) + ':' + Math.max(ga, gb);
}
