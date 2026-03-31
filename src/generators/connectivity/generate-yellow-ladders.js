/**
 * Generate yellow ladders for blocked walkways.
 */

import { CONNECTIVITY } from '../../config.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

/**
 * Generate yellow ladders for blocked walkways.
 * @param {object} ctx - { data, config }
 * @param {object[]} culledWalkways
 * @returns {object[]} ladders
 */
export function generateYellowLadders(ctx, culledWalkways) {
  const { data, config } = ctx;
  const { tierHeight, slabThickness } = config;
  const ladders = [];

  // For blocked walkways, place a ladder on the side(s) that touch a wall.
  // Ladder goes up from the walkway until it reaches a tier with no wall.

  for (let wi = 0; wi < culledWalkways.length; wi++) {
    const w = culledWalkways[wi];
    if (!w.blocked) continue;

    const tier = Math.round(w.y / tierHeight);
    const wallTierY = tier * tierHeight + slabThickness;
    const margin = 0.3;

    // Check start and end of walkway for wall clash
    for (const endpoint of ['start', 'end']) {
      // Build a small test rect at the endpoint
      let testX, testZ, testW, testD;
      if (w.axis === 'x') {
        testX = endpoint === 'start' ? w.x - margin : w.x + w.w - margin;
        testZ = w.z;
        testW = margin * 2;
        testD = w.d;
      } else {
        testX = w.x;
        testZ = endpoint === 'start' ? w.z - margin : w.z + w.d - margin;
        testW = w.w;
        testD = margin * 2;
      }

      // Does this endpoint touch a wall on this tier?
      let touchesWall = false;
      for (const wall of data.walls) {
        if (Math.abs(wall.baseY - wallTierY) > 0.5) continue;
        const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
        const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
        if (testX < wallX1 + margin && testX + testW > wall.x - margin &&
            testZ < wallZ1 + margin && testZ + testD > wall.z - margin) {
          touchesWall = true;
          break;
        }
      }

      if (!touchesWall) continue;

      // Place ladder flat against the wall, half walkway width, centred
      const wallOffset = 0.3;
      let ladderX, ladderZ, ladderW, ladderD;
      if (w.axis === 'x') {
        ladderX = endpoint === 'start' ? w.x - LADDER_DEPTH + wallOffset : w.x + w.w - wallOffset;
        ladderZ = w.z + w.d / 2 - LADDER_WIDTH / 2;
        ladderW = LADDER_DEPTH;
        ladderD = LADDER_WIDTH;
      } else {
        ladderX = w.x + w.w / 2 - LADDER_WIDTH / 2;
        ladderZ = endpoint === 'start' ? w.z - LADDER_DEPTH + wallOffset : w.z + w.d - wallOffset;
        ladderW = LADDER_WIDTH;
        ladderD = LADDER_DEPTH;
      }

      // Find the highest tier that still has a wall at this position
      let topTier = tier;
      for (let t = tier + 1; t <= config.tiers; t++) {
        const checkY = t * tierHeight + slabThickness;
        let hasWall = false;
        for (const wall of data.walls) {
          if (Math.abs(wall.baseY - checkY) > 0.5) continue;
          const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
          const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
          if (ladderX < wallX1 + margin && ladderX + ladderW > wall.x - margin &&
              ladderZ < wallZ1 + margin && ladderZ + ladderD > wall.z - margin) {
            hasWall = true;
            break;
          }
        }
        if (hasWall) topTier = t;
        else break;
      }

      // Trim to highest tier that has a floor near the ladder
      let ladderTopTier = topTier + 1;
      while (ladderTopTier > tier) {
        const fd = data.floors.find((f) => f.tier === ladderTopTier);
        if (fd && fd.sections.some((s) =>
          ladderX < s.x + s.w + 0.5 && ladderX + ladderW > s.x - 0.5 &&
          ladderZ < s.z + s.d + 0.5 && ladderZ + ladderD > s.z - 0.5
        )) {
          break;
        }
        ladderTopTier--;
      }

      const ladderY0 = w.y; // start at walkway level
      const ladderY1 = ladderTopTier * tierHeight;

      if (ladderY1 > ladderY0) {
        ladders.push({
          type: 'ladder',
          parentWalkway: w, // link to source walkway
          x: ladderX, z: ladderZ,
          w: ladderW, d: ladderD,
          y0: ladderY0, y1: ladderY1,
        });
      }
    }
  }

  return ladders;
}
