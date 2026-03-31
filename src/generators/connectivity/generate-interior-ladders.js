/**
 * Generate interior/cyan ladders through exposed internal quadrant edges.
 */

import { CONNECTIVITY } from '../../config.js';
import { getQuadrantRect } from './get-quadrant-rect.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

/**
 * Generate interior/cyan ladders through exposed internal quadrant edges.
 * @param {object} ctx - { data, config }
 * @returns {object[]} interiorLadders
 */
export function generateInteriorLadders(ctx) {
  const { data, config } = ctx;
  const { tierHeight } = config;

  // Interior ladders (cyan) — climb through exposed internal quadrant edges
  // Find internal edges where the adjacent quadrant is missing above,
  // then ladder from the solid floor below up through the gap
  const interiorLadders = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];
    const mx = b.x + b.w / 2;
    const mz = b.z + b.d / 2;

    // For each tier, check internal edges for exposed gaps
    for (let tier = 2; tier <= b.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;

      for (const q of present) {
        const qr = getQuadrantRect(b, q);
        // Check each internal neighbor
        const neighbors = [
          { nq: (q === 0) ? 1 : (q === 2) ? 3 : -1, side: 'east', axis: 'z' },
          { nq: (q === 1) ? 0 : (q === 3) ? 2 : -1, side: 'west', axis: 'z' },
          { nq: (q === 0) ? 2 : (q === 1) ? 3 : -1, side: 'south', axis: 'x' },
          { nq: (q === 2) ? 0 : (q === 3) ? 1 : -1, side: 'north', axis: 'x' },
        ];

        for (const { nq, side, axis } of neighbors) {
          if (nq < 0) continue;
          // Only interested if neighbor is MISSING at this tier (exposed internal edge)
          if (present.has(nq)) continue;

          // Find the lowest tier where BOTH quadrants exist (solid floor below)
          let baseTier = -1;
          for (let t = tier - 1; t >= 1; t--) {
            const pAtT = bq.tiers[t];
            if (pAtT && pAtT.has(q) && pAtT.has(nq)) {
              baseTier = t;
              break;
            }
          }
          // If no solid floor found, start from ground
          if (baseTier < 0) baseTier = 0;

          // Find the highest tier where this internal edge is still exposed
          let topTier = tier;
          for (let t = tier + 1; t <= b.maxTier; t++) {
            const pAtT = bq.tiers[t];
            if (pAtT && pAtT.has(q) && !pAtT.has(nq)) {
              topTier = t;
            } else {
              break;
            }
          }

          // Must span at least 1 tier
          if (topTier <= baseTier) continue;

          // Position: on the internal edge, centred
          let lx, lz, lw, ld;
          if (side === 'east') {
            lx = qr.x + qr.w - LADDER_DEPTH / 2;
            lz = qr.z + qr.d / 2 - LADDER_WIDTH / 2;
            lw = LADDER_DEPTH; ld = LADDER_WIDTH;
          } else if (side === 'west') {
            lx = qr.x - LADDER_DEPTH / 2;
            lz = qr.z + qr.d / 2 - LADDER_WIDTH / 2;
            lw = LADDER_DEPTH; ld = LADDER_WIDTH;
          } else if (side === 'south') {
            lx = qr.x + qr.w / 2 - LADDER_WIDTH / 2;
            lz = qr.z + qr.d - LADDER_DEPTH / 2;
            lw = LADDER_WIDTH; ld = LADDER_DEPTH;
          } else {
            lx = qr.x + qr.w / 2 - LADDER_WIDTH / 2;
            lz = qr.z - LADDER_DEPTH / 2;
            lw = LADDER_WIDTH; ld = LADDER_DEPTH;
          }

          // Trim to highest tier that has a floor near the ladder
          let trimmedTop = topTier;
          while (trimmedTop > baseTier) {
            const fd = data.floors.find((f) => f.tier === trimmedTop);
            if (fd && fd.sections.some((s) =>
              lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
              lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
            )) {
              break;
            }
            trimmedTop--;
          }
          if (trimmedTop <= baseTier) continue;

          const y0 = baseTier * tierHeight;
          const y1 = trimmedTop * tierHeight;

          interiorLadders.push({
            type: 'interior_ladder',
            x: lx, z: lz,
            w: lw, d: ld,
            y0, y1,
          });
        }
      }
    }
  }

  return interiorLadders;
}
