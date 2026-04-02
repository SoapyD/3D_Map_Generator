/**
 * Generate ground/red ladders from ground level up building walls.
 */

import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { getQuadrantRect } from './get-quadrant-rect.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

/**
 * Generate ground/red ladders from ground level up building walls.
 * @param {object} ctx - { data, config }
 * @param {object[]} culledWalkways
 * @returns {object[]} filteredGroundLadders
 */
export function generateGroundLadders(ctx, culledWalkways) {
  const { data, config } = ctx;
  const { tierHeight, slabThickness } = config;

  // Ground floor ladders: for each ground floor quadrant's outward-facing edges,
  // check if there's a wall. If so, place a red ladder from ground up to the
  // first tier with no wall. Skip edges near map boundary.
  const groundLadders = [];
  const MAP_BOUNDARY_MARGIN = CONNECTIVITY.mapBoundaryMargin;

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.size === 'tower') continue; // towers have their own ladder generation above
    const bq = data.buildingQuadrants[bi];
    const present = bq.tiers[1] || new Set([0, 1, 2, 3]);

    for (const q of present) {
      const qr = getQuadrantRect(b, q);

      // Only external edges — skip edges shared with another present quadrant
      // Adjacency: 0↔1 (east/west), 2↔3 (east/west), 0↔2 (south/north), 1↔3 (south/north)
      const neighborN = (q === 2) ? 0 : (q === 3) ? 1 : -1; // quadrant above
      const neighborS = (q === 0) ? 2 : (q === 1) ? 3 : -1; // quadrant below
      const neighborW = (q === 1) ? 0 : (q === 3) ? 2 : -1; // quadrant left
      const neighborE = (q === 0) ? 1 : (q === 2) ? 3 : -1; // quadrant right

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
        if (edge.side === 'north' && edge.z < MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'south' && edge.z > config.mapDepth - MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'west' && edge.x < MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'east' && edge.x > config.mapWidth - MAP_BOUNDARY_MARGIN) continue;

        const ladderWidth = LADDER_WIDTH;

        // Visual ladder position: centred on edge midpoint, flat against wall, offset 0.3" out
        let lx, lz, lw, ld;
        const wallOffset = 0.3;
        if (edge.axis === 'x') {
          lx = edge.x + edge.len / 2 - ladderWidth / 2;
          lz = edge.side === 'north' ? edge.z - wallOffset : edge.z - LADDER_DEPTH + wallOffset;
          lw = ladderWidth;
          ld = LADDER_DEPTH;
        } else {
          lx = edge.side === 'west' ? edge.x - wallOffset : edge.x - LADDER_DEPTH + wallOffset;
          lz = edge.z + edge.len / 2 - ladderWidth / 2;
          lw = LADDER_DEPTH;
          ld = ladderWidth;
        }

        // Check for ground wall using the VISUAL ladder position
        const groundWallY = slabThickness;
        let hasGroundWall = false;
        const margin = 0.3;
        for (const wall of data.walls) {
          if (Math.abs(wall.baseY - groundWallY) > 0.5) continue;
          const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
          const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
          if (lx < wallX1 + margin && lx + lw > wall.x - margin &&
              lz < wallZ1 + margin && lz + ld > wall.z - margin) {
            hasGroundWall = true;
            break;
          }
        }
        if (!hasGroundWall) continue;

        // Find the highest tier where a wall overlaps the VISUAL ladder position
        let topTier = 0;
        for (let t = 1; t <= config.tiers; t++) {
          const checkY = t * tierHeight + slabThickness;
          let hasWall = false;
          for (const wall of data.walls) {
            if (Math.abs(wall.baseY - checkY) > 0.5) continue;
            const wallX1 = wall.axis === 'x' ? wall.x + wall.length : wall.x + wall.thickness;
            const wallZ1 = wall.axis === 'z' ? wall.z + wall.length : wall.z + wall.thickness;
            if (lx < wallX1 + margin && lx + lw > wall.x - margin &&
                lz < wallZ1 + margin && lz + ld > wall.z - margin) {
              hasWall = true;
              break;
            }
          }
          if (hasWall) topTier = t;
          else break;
        }

        // Ladder reaches the floor above the last walled tier,
        // but only if that floor actually exists near this quadrant
        // Trim to highest tier that has a floor near the ladder's visual position
        let ladderTopTier = topTier + 1;
        while (ladderTopTier > 0) {
          const floorData2 = data.floors.find((f) => f.tier === ladderTopTier);
          if (floorData2 && floorData2.sections.some((s) =>
            lx < s.x + s.w + 0.5 && lx + lw > s.x - 0.5 &&
            lz < s.z + s.d + 0.5 && lz + ld > s.z - 0.5
          )) {
            break;
          }
          ladderTopTier--;
        }

        const ladderY0 = 0;
        const ladderY1 = ladderTopTier * tierHeight;

        if (ladderY1 > ladderY0) {
          groundLadders.push({
            type: 'ground_ladder',
            x: lx, z: lz,
            w: lw, d: ld,
            y0: ladderY0, y1: ladderY1,
          });
        }
      }
    }
  }

  // Remove ground ladders that touch any walkway
  const filteredGroundLadders = DELETIONS.redLadderWalkwayOverlap
    ? groundLadders.filter((gl) => {
        for (const w of culledWalkways) {
          if (gl.x < w.x + w.w && gl.x + gl.w > w.x &&
              gl.z < w.z + w.d && gl.z + gl.d > w.z) {
            return false;
          }
        }
        return true;
      })
    : groundLadders;

  return filteredGroundLadders;
}
