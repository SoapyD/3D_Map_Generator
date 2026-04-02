import { COVER } from '../../config.js';

const COVER_TYPES = COVER.types;

/**
 * Pick a random cover type using weighted chances.
 */
export function pickCoverType(rng) {
  const roll = rng.random();
  let cumulative = 0;
  for (const t of COVER_TYPES) {
    cumulative += t.chance;
    if (roll < cumulative) return t;
  }
  return COVER_TYPES[0];
}
