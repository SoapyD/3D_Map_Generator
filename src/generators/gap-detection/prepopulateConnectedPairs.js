import { findBldForPoint } from './findBldForPoint.js';
import { makePairKey } from './makePairKey.js';

/**
 * Pre-populate connectedPairs set from existing walkways so we don't
 * create duplicate forced connections for pairs that are already linked.
 */
export function prepopulateConnectedPairs(existingWalkways, buildings, connectedPairs) {
  for (const ew of existingWalkways) {
    let s, e;
    if (ew.axis === 'x') {
      s = findBldForPoint(ew.x, ew.z + (ew.d || 2) / 2, buildings);
      e = findBldForPoint(ew.x + ew.w, ew.z + (ew.d || 2) / 2, buildings);
    } else {
      s = findBldForPoint(ew.x + (ew.w || 2) / 2, ew.z, buildings);
      e = findBldForPoint(ew.x + (ew.w || 2) / 2, ew.z + ew.d, buildings);
    }
    if (s >= 0 && e >= 0 && s !== e) {
      const pk = makePairKey(s, e, buildings);
      if (pk) connectedPairs.add(pk);
    }
  }
}
