/**
 * Stage 1: Foundation Generation
 *
 * Divides the map into city blocks separated by streets.
 * The active area is snapped to BBD; any remainder becomes an equal skirt.
 *
 * Output: Array of block rectangles { x, z, w, d } and street areas.
 */

import { GLOBAL_GRID } from '../../config.js';
import { deriveStreetRects } from '../streets/derive-street-rects.js';
import { generateCenterFirst } from './strategies/center-first.js';

const FOUNDATION_STRATEGY = generateCenterFirst; // TODO: make configurable

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

  const blocks = FOUNDATION_STRATEGY(activeArea, rng, streetWidth, bbd);
  const streetBounds = deriveStreetRects(blocks, skirtX, skirtZ, activeW, activeD);
  return { blocks, streetBounds, activeArea, skirt: { x: skirtX, z: skirtZ } };
}
