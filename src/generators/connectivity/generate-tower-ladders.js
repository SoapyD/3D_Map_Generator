/**
 * Generate tower ladders — placed last so they don't overlap existing ladders.
 */

import { CONNECTIVITY } from '../../config.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

/**
 * Generate tower ladders — placed last so they don't overlap existing ladders.
 * @param {object} ctx - { data, config, rng }
 * @param {object} ladderResults - { survivingYellow, finalRed, finalOrange, finalInterior }
 * @returns {object[]} finalRed (mutated with tower ladders appended)
 */
export function generateTowerLadders(ctx, ladderResults) {
  const { data, config, rng } = ctx;
  const { tierHeight } = config;
  const { survivingYellow, finalRed, finalOrange, finalInterior } = ladderResults;

  const towerBuildings = data.buildings.filter(b => b.size === 'tower');

  // Tower ladders — placed last so they don't overlap existing ladders
  // Collect all existing ladders for overlap checking
  const allExistingLadders = [...survivingYellow, ...finalRed, ...finalOrange, ...finalInterior];

  for (const building of towerBuildings) {
    const topTier = building.pyramidRoof ? building.maxTier - 1 : building.maxTier;
    if (topTier < 1) continue;

    const y0 = 0;
    const y1 = topTier * tierHeight;

    // Try each side, pick one that doesn't overlap any existing ladder
    const sides = rng.shuffle(['north', 'south', 'east', 'west']);
    let placed = false;

    for (const side of sides) {
      let lx, lz, lw, ld;
      if (side === 'north') {
        lx = building.x + building.w / 2 - LADDER_WIDTH / 2;
        lz = building.z - LADDER_DEPTH;
        lw = LADDER_WIDTH; ld = LADDER_DEPTH;
      } else if (side === 'south') {
        lx = building.x + building.w / 2 - LADDER_WIDTH / 2;
        lz = building.z + building.d;
        lw = LADDER_WIDTH; ld = LADDER_DEPTH;
      } else if (side === 'west') {
        lx = building.x - LADDER_DEPTH;
        lz = building.z + building.d / 2 - LADDER_WIDTH / 2;
        lw = LADDER_DEPTH; ld = LADDER_WIDTH;
      } else {
        lx = building.x + building.w;
        lz = building.z + building.d / 2 - LADDER_WIDTH / 2;
        lw = LADDER_DEPTH; ld = LADDER_WIDTH;
      }

      // Check map bounds
      if (lx < 0 || lz < 0 || lx + lw > config.mapWidth || lz + ld > config.mapDepth) continue;

      // Check overlap with any existing ladder
      let overlaps = false;
      for (const el of allExistingLadders) {
        if (lx < el.x + (el.w || 1) + 0.3 && lx + lw > el.x - 0.3 &&
            lz < el.z + (el.d || 1) + 0.3 && lz + ld > el.z - 0.3) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) continue;

      // Place the ladder
      const ladder = { type: 'ground_ladder', platformDir: side, x: lx, z: lz, w: lw, d: ld, y0, y1 };
      finalRed.push(ladder);
      allExistingLadders.push(ladder);
      placed = true;

      // Delete wall segments that overlap the ladder at the termination floor
      const exitY = topTier * tierHeight;
      for (let wi = data.walls.length - 1; wi >= 0; wi--) {
        const wall = data.walls[wi];
        if (wall.baseY < exitY) continue;
        const wx1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
        const wz1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
        if (lx < wx1 + 0.3 && lx + lw > wall.x - 0.3 &&
            lz < wz1 + 0.3 && lz + ld > wall.z - 0.3) {
          data.walls.splice(wi, 1);
        }
      }
      break;
    }
    // If no side is free, skip this tower's ladder
  }

  return finalRed;
}
