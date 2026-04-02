/**
 * Generate orange ladders on quadrant edges, spanning multiple tiers.
 */

import { CONNECTIVITY } from '../../config.js';
import { getQuadrantRect } from './get-quadrant-rect.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

/**
 * Generate orange ladders on quadrant edges, spanning multiple tiers.
 * @param {object} ctx - { data, config, rng }
 * @returns {object[]} orangeLadders
 */
export function generateOrangeLadders(ctx) {
  const { data, config, rng } = ctx;
  const { tierHeight } = config;

  // Orange ladders: placed on any quadrant edge, any tier except top.
  // Go up one tier. Only kept if they connect to a floor above.
  // Deleted if they touch a walkway or red ladder.
  const orangeLadders = [];
  const MAP_BOUNDARY_MARGIN = CONNECTIVITY.mapBoundaryMargin;

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.size === 'tower') continue; // towers have their own ladder generation
    const bq = data.buildingQuadrants[bi];

    for (let tier = 0; tier < config.tiers; tier++) {
      // Use tier 1 quadrants for ground level, otherwise the tier's quadrants
      const present = tier === 0
        ? (bq.tiers[1] || new Set([0, 1, 2, 3]))
        : bq.tiers[tier];
      if (!present) continue;

      for (const q of present) {
        const qr = getQuadrantRect(b, q);

        // External edges only
        const neighborN = (q === 2) ? 0 : (q === 3) ? 1 : -1;
        const neighborS = (q === 0) ? 2 : (q === 1) ? 3 : -1;
        const neighborW = (q === 1) ? 0 : (q === 3) ? 2 : -1;
        const neighborE = (q === 0) ? 1 : (q === 2) ? 3 : -1;

        const edges = [];
        if (neighborN < 0 || !present.has(neighborN))
          edges.push({ side: 'north', x: qr.x, z: qr.z, len: qr.w, axis: 'x' });
        if (neighborS < 0 || !present.has(neighborS))
          edges.push({ side: 'south', x: qr.x, z: qr.z + qr.d, len: qr.w, axis: 'x' });
        if (neighborW < 0 || !present.has(neighborW))
          edges.push({ side: 'west', x: qr.x, z: qr.z, len: qr.d, axis: 'z' });
        if (neighborE < 0 || !present.has(neighborE))
          edges.push({ side: 'east', x: qr.x + qr.w, z: qr.z, len: qr.d, axis: 'z' });

        for (const edge of edges) {
          // Skip edges near map boundary
          if (edge.side === 'north' && edge.z < MAP_BOUNDARY_MARGIN) continue;
          if (edge.side === 'south' && edge.z > config.mapDepth - MAP_BOUNDARY_MARGIN) continue;
          if (edge.side === 'west' && edge.x < MAP_BOUNDARY_MARGIN) continue;
          if (edge.side === 'east' && edge.x > config.mapWidth - MAP_BOUNDARY_MARGIN) continue;

          // Spawn chance: 10% on ground floor, 20% on tier 1, 30% on tier 2+
          const spawnChance = tier === 0 ? CONNECTIVITY.orangeSpawnChance.ground : tier === 1 ? CONNECTIVITY.orangeSpawnChance.tier1 : CONNECTIVITY.orangeSpawnChance.tier2Plus;
          if (!rng.chance(spawnChance)) continue;

          // Position: centred on edge, outside building, ladder width
          const wallOffset = 0.3;
          let lx, lz, lw, ld;
          if (edge.axis === 'x') {
            lx = edge.x + edge.len / 2 - LADDER_WIDTH / 2;
            lz = edge.side === 'north' ? edge.z - wallOffset : edge.z - LADDER_DEPTH + wallOffset;
            lw = LADDER_WIDTH;
            ld = LADDER_DEPTH;
          } else {
            lx = edge.side === 'west' ? edge.x - wallOffset : edge.x - LADDER_DEPTH + wallOffset;
            lz = edge.z + edge.len / 2 - LADDER_WIDTH / 2;
            lw = LADDER_DEPTH;
            ld = LADDER_WIDTH;
          }

          // Climb upward through multiple tiers until no floor exists
          // Use the ladder's visual position, not the source quadrant
          const y0 = tier * tierHeight;
          let topTier = tier;
          for (let t = tier + 1; t <= config.tiers; t++) {
            const floorAtT = data.floors.find((f) => f.tier === t);
            if (floorAtT && floorAtT.sections.some((s) =>
              lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
              lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
            )) {
              topTier = t;
            } else {
              break;
            }
          }

          // Must span at least 2 tiers
          if (topTier - tier < CONNECTIVITY.orangeMinSpan) continue;
          const y1 = topTier * tierHeight;

          orangeLadders.push({
            type: 'orange_ladder',
            x: lx, z: lz,
            w: lw, d: ld,
            y0, y1,
          });
        }
      }
    }
  }

  return orangeLadders;
}
