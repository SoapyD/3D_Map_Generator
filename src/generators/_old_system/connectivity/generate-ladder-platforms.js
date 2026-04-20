/**
 * Generate ladder platforms at each floor a ladder spans.
 */

import { GEOMETRY } from '../../config.js';

/**
 * Generate ladder platforms at each floor a ladder spans.
 * @param {object} ctx - { data }
 * @param {object} ladderResults - { survivingYellow, finalRed, finalOrange, finalInterior }
 * @param {object[]} finalWalkways
 * @param {number} tierHeight
 * @returns {object[]} filteredPlatforms
 */
export function generateLadderPlatforms(ctx, ladderResults, finalWalkways, tierHeight) {
  const { data } = ctx;
  const { survivingYellow, finalRed, finalOrange, finalInterior } = ladderResults;

  // Generate ladder platforms — 2x2" platforms at each floor a ladder spans
  const PLATFORM_SIZE = GEOMETRY.platformSize;
  const PLATFORM_THICKNESS = GEOMETRY.platformThickness;
  const ladderPlatforms = [];
  const allLadders = [...survivingYellow, ...finalRed, ...finalOrange, ...finalInterior];

  for (let li = 0; li < allLadders.length; li++) {
    const ladder = allLadders[li];
    if (ladder.bad) continue;
    const startTier = Math.ceil(ladder.y0 / tierHeight);
    const endTier = Math.floor(ladder.y1 / tierHeight);

    for (let t = startTier; t <= endTier; t++) {
      const py = t * tierHeight;
      // Skip if platform is at the very bottom or top of the ladder
      if (Math.abs(py - ladder.y0) < 0.1 || Math.abs(py - ladder.y1) < 0.1) continue;

      // Use the ladder's platformDir to extend the platform outward from the wall
      let px, pz;
      const dir = ladder.platformDir;
      if (dir === 'east') {
        px = ladder.x;
        pz = ladder.z + ladder.d / 2 - PLATFORM_SIZE / 2;
      } else if (dir === 'west') {
        px = ladder.x + ladder.w - PLATFORM_SIZE;
        pz = ladder.z + ladder.d / 2 - PLATFORM_SIZE / 2;
      } else if (dir === 'south') {
        px = ladder.x + ladder.w / 2 - PLATFORM_SIZE / 2;
        pz = ladder.z;
      } else {
        // north
        px = ladder.x + ladder.w / 2 - PLATFORM_SIZE / 2;
        pz = ladder.z + ladder.d - PLATFORM_SIZE;
      }

      ladderPlatforms.push({
        x: px, z: pz,
        w: PLATFORM_SIZE, d: PLATFORM_SIZE,
        y: py,
        ladderIndex: li,
      });
    }
  }

  // Remove platforms that touch walkways
  const filteredPlatforms = ladderPlatforms.filter((p) => {
    for (const w of finalWalkways) {
      if (Math.abs(p.y - w.y) > 1) continue;
      if (p.x < w.x + w.w && p.x + p.w > w.x &&
          p.z < w.z + w.d && p.z + p.d > w.z) {
        return false;
      }
    }
    return true;
  });

  return filteredPlatforms;
}
