import { DELETIONS } from '../../config.js';
import { walkwaysIntersect } from './walkways-intersect.js';

export function stripIntersectingWalkways(walkways) {
  if (!DELETIONS.walkwayIntersectionStrip) return walkways;
  const toDrop = new Set();
  for (let i = 0; i < walkways.length; i++) {
    if (toDrop.has(i)) continue;
    for (let j = i + 1; j < walkways.length; j++) {
      if (toDrop.has(j)) continue;
      if (walkwaysIntersect(walkways[i], walkways[j])) toDrop.add(j);
    }
  }
  return walkways.filter((_, i) => !toDrop.has(i));
}
