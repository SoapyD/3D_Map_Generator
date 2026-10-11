import { FLOOR_SLAB } from '../../config.js';
import { levelHeight } from './levelHeight.js';

const EPS = 1e-6;

/**
 * Tier whose band contains world Y `y`. A tier owns its slab, its wall rows and the connector slabs
 * that sit flush on its surface, so the band starts FLOOR_SLAB.bandLookahead below each floor surface.
 */
export function tierIndexFromY(y, config) {
  return Math.floor((y + FLOOR_SLAB.bandLookahead + EPS) / levelHeight(config));
}
