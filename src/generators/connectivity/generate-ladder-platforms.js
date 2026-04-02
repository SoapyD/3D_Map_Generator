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

      // Centre platform on the ladder's wide axis, align outer edge with ladder's outer face
      let px, pz;
      if (ladder.w < ladder.d) {
        // Thin in X (ladder flat against wall in X) — extend platform outward in X
        // Find nearest building to determine which side the wall is on
        let nearestBuildingCx = ladder.x; // default
        for (const b of data.buildings) {
          if (ladder.z + ladder.d > b.z && ladder.z < b.z + b.d &&
              Math.abs(ladder.x - b.x) < b.w + 1) {
            nearestBuildingCx = b.x + b.w / 2;
            break;
          }
        }
        // If ladder is to the right of building centre, extend right; else left
        if (ladder.x > nearestBuildingCx) {
          px = ladder.x; // flush with ladder, extending right
        } else {
          px = ladder.x + ladder.w - PLATFORM_SIZE; // flush, extending left
        }
        pz = ladder.z + ladder.d / 2 - PLATFORM_SIZE / 2;
      } else {
        // Thin in Z (ladder flat against wall in Z)
        px = ladder.x + ladder.w / 2 - PLATFORM_SIZE / 2;
        let nearestBuildingCz = ladder.z;
        for (const b of data.buildings) {
          if (ladder.x + ladder.w > b.x && ladder.x < b.x + b.w &&
              Math.abs(ladder.z - b.z) < b.d + 1) {
            nearestBuildingCz = b.z + b.d / 2;
            break;
          }
        }
        if (ladder.z > nearestBuildingCz) {
          pz = ladder.z;
        } else {
          pz = ladder.z + ladder.d - PLATFORM_SIZE;
        }
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
