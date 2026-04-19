/**
 * Stage 1: BSP Grid Partitioning
 *
 * Divides the map into city blocks separated by streets.
 * Uses Binary Space Partitioning for irregular block sizes.
 *
 * Output: Array of block rectangles { x, z, w, d } and street areas.
 */

import { GRID, GLOBAL_GRID } from '../../config.js';
import { bspSplit } from './bsp-split.js';
import { deriveStreetRects } from '../streets/derive-street-rects.js';
import { biasedCenter } from './split-strategies/biased-center.js';
import { centerOut } from '../buildings/spawn-patterns/center-out.js';

const SPLIT_STRATEGY = biasedCenter;  // TODO: make configurable
const SPAWN_PATTERN  = centerOut;     // TODO: make configurable

/**
 * @param {object} config
 * @param {import('../../core/rng.js').createRng} rng
 * @returns {{ blocks, streetBounds, activeArea: {x,z,w,d}, skirt: {x,z} }}
 */
export function generateGrid(config, rng) {
  const { mapWidth, mapDepth, streetWidth } = config;
  const { bbd } = GLOBAL_GRID;

  // Snap active area to BBD — any remainder becomes an equal skirt on each side
  const activeW = Math.floor(mapWidth / bbd) * bbd;
  const activeD = Math.floor(mapDepth / bbd) * bbd;
  const skirtX = (mapWidth - activeW) / 2;
  const skirtZ = (mapDepth - activeD) / 2;
  const activeArea = { x: skirtX, z: skirtZ, w: activeW, d: activeD };

  // BSP splits within the active area only
  const root = { x: skirtX, z: skirtZ, w: activeW, d: activeD };
  const leaves = [];
  bspSplit(root, rng, streetWidth, bbd, leaves, SPLIT_STRATEGY);

  const blocks = SPAWN_PATTERN(leaves, activeArea);
  const streetBounds = deriveStreetRects(blocks, skirtX, skirtZ, activeW, activeD);
  return { blocks, streetBounds, activeArea, skirt: { x: skirtX, z: skirtZ } };
}
