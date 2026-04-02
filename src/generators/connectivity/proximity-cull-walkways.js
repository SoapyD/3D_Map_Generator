/**
 * Proximity-cull walkways (same tier, too close together).
 */

import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { isClose } from './is-close.js';

/**
 * Proximity-cull walkways (same tier, too close together).
 * @param {object[]} culledWalkways
 * @returns {object[]} finalWalkways
 */
export function proximityCullWalkways(culledWalkways) {
  const PROXIMITY = CONNECTIVITY.proximity;

  let finalWalkways;
  if (DELETIONS.walkwayProximityCull) {
    const walkwayDropSet = new Set();
    for (let i = 0; i < culledWalkways.length; i++) {
      if (walkwayDropSet.has(i)) continue;
      for (let j = i + 1; j < culledWalkways.length; j++) {
        if (walkwayDropSet.has(j)) continue;
        if (Math.abs(culledWalkways[i].y - culledWalkways[j].y) > 0.5) continue;
        if (isClose(culledWalkways[i], culledWalkways[j], PROXIMITY)) {
          walkwayDropSet.add(j);
        }
      }
    }
    finalWalkways = culledWalkways.filter((_, i) => !walkwayDropSet.has(i));
  } else {
    finalWalkways = culledWalkways;
  }

  return finalWalkways;
}
