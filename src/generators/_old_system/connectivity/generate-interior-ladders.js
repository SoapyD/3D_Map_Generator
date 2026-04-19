/**
 * Generate interior/cyan ladders through exposed internal quadrant edges.
 */
import { getQuadrantRect } from './get-quadrant-rect.js';
import { positionInteriorLadder } from './position-interior-ladder.js';
import { findInteriorLadderTierRange } from './find-interior-ladder-tier-range.js';

export function generateInteriorLadders(ctx) {
  const { data, config } = ctx;
  const { tierHeight } = config;
  const interiorLadders = [];

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    const bq = data.buildingQuadrants[bi];

    for (let tier = 2; tier <= b.maxTier; tier++) {
      const present = bq.tiers[tier];
      if (!present) continue;

      for (const q of present) {
        const qr = getQuadrantRect(b, q);
        const neighbors = [
          { nq: (q === 0) ? 1 : (q === 2) ? 3 : -1, side: 'east' },
          { nq: (q === 1) ? 0 : (q === 3) ? 2 : -1, side: 'west' },
          { nq: (q === 0) ? 2 : (q === 1) ? 3 : -1, side: 'south' },
          { nq: (q === 2) ? 0 : (q === 3) ? 1 : -1, side: 'north' },
        ];

        for (const { nq, side } of neighbors) {
          if (nq < 0 || present.has(nq)) continue;

          const { baseTier, topTier } = findInteriorLadderTierRange(q, nq, tier, bq, b.maxTier);
          if (topTier <= baseTier) continue;

          const { x: lx, z: lz, w: lw, d: ld } = positionInteriorLadder(qr, side);

          let trimmedTop = topTier;
          while (trimmedTop > baseTier) {
            const fd = data.floors.find((f) => f.tier === trimmedTop);
            if (fd && fd.sections.some((s) =>
              lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
              lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
            )) break;
            trimmedTop--;
          }
          if (trimmedTop <= baseTier) continue;

          // Platform extends toward the missing quadrant (out from the floor edge)
          interiorLadders.push({
            type: 'interior_ladder',
            platformDir: side,
            x: lx, z: lz, w: lw, d: ld,
            y0: baseTier * tierHeight, y1: trimmedTop * tierHeight,
          });
        }
      }
    }
  }

  return interiorLadders;
}
