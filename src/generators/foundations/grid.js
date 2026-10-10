/**
 * Stage 1: Foundation Generation
 *
 * Divides the map into city blocks separated by streets.
 * The active area is snapped to BBD; any remainder becomes an equal skirt.
 *
 * Output: Array of block rectangles { x, z, w, d } and street areas.
 */

import { GLOBAL_GRID, GRID } from '../../config.js';
import { deriveStreetRects } from '../streets/derive-street-rects.js';
import { generateCenterFirst } from './strategies/center-first.js';
import { generateBspTopLeft } from './strategies/bsp-top-left.js';

const FOUNDATION_STRATEGIES = [generateCenterFirst, generateBspTopLeft];
const FIXED_STRATEGIES = { centerFirst: generateCenterFirst, bspTopLeft: generateBspTopLeft };

// 'random' keeps the original 50/50 pick (and its RNG draw); a named strategy consumes no RNG.
function pickStrategy(rng) {
  return FIXED_STRATEGIES[GRID.strategy] ?? FOUNDATION_STRATEGIES[rng.chance(0.5) ? 0 : 1];
}

/**
 * @param {object} config
 * @param {import('../../core/rng.js').createRng} rng
 * @returns {{ blocks, streetBounds, activeArea: {x,z,w,d}, skirt: {x,z} }}
 */
export function generateGrid(config, rng) {
  const { mapWidth, mapDepth, streetWidth } = config;
  const { bbd } = GLOBAL_GRID;

  const activeW = Math.floor(mapWidth / bbd) * bbd;
  const activeD = Math.floor(mapDepth / bbd) * bbd;
  const skirtX = (mapWidth - activeW) / 2;
  const skirtZ = (mapDepth - activeD) / 2;
  const activeArea = { x: skirtX, z: skirtZ, w: activeW, d: activeD };

  const strategy = pickStrategy(rng);
  const blocks = strategy(activeArea, rng, streetWidth, bbd);
  const streetBounds = deriveStreetRects(blocks, skirtX, skirtZ, activeW, activeD);
  return { blocks, streetBounds, activeArea, skirt: { x: skirtX, z: skirtZ } };
}
