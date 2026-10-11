import { levelHeight } from './levelHeight.js';

/** Matrix Y extent (cells above 0) needed for `maxTiers` tiers plus one tier of headroom. */
export function matrixHeight(maxTiers, config) {
  return (maxTiers + 1) * levelHeight(config);
}
