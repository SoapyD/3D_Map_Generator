/**
 * Stage 1: BSP Grid Partitioning
 *
 * Divides the map into city blocks separated by streets.
 * Uses Binary Space Partitioning for irregular block sizes.
 *
 * Output: Array of block rectangles { x, z, w, d } and street areas.
 */

import { GRID } from '../config.js';
import { bspSplit } from './bsp-split.js';
import { extractStreets } from './extract-streets.js';

/**
 * @param {object} config
 * @param {import('../core/rng.js').createRng} rng
 * @returns {{ blocks: Array<{x,z,w,d}>, streets: Array<{x,z,w,d}> }}
 */
export function generateGrid(config, rng) {
  const { mapWidth, mapDepth, streetWidth } = config;

  // Start with the full map as one region
  const root = { x: 0, z: 0, w: mapWidth, d: mapDepth };

  // BSP split recursively
  const leaves = [];
  bspSplit(root, rng, streetWidth, leaves);

  // Extract streets from the gaps between blocks
  const streets = extractStreets(leaves, mapWidth, mapDepth, streetWidth);

  return { blocks: leaves, streets };
}

