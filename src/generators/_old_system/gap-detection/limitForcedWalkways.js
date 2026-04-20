import { CONNECTIVITY } from '../../config.js';

/**
 * Sort forced walkways by length (longest first) and cap to the configured max count.
 */
export function limitForcedWalkways(deduped, rng) {
  deduped.sort((a, b) => {
    const lenA = a.axis === 'x' ? a.w : a.d;
    const lenB = b.axis === 'x' ? b.w : b.d;
    return lenB - lenA;
  });
  const countRange = CONNECTIVITY.forcedMaxCount;
  const maxForced = Array.isArray(countRange)
    ? Math.min(deduped.length, rng.int(countRange[0], countRange[1]))
    : Math.min(deduped.length, countRange || 15);
  return deduped.slice(0, maxForced);
}
