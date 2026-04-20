/**
 * Generate ground/red ladders from ground level up building walls.
 */
import { CONNECTIVITY, DELETIONS } from '../../config.js';
import { getQuadrantRect } from './get-quadrant-rect.js';
import { buildGroundLadderForEdge } from './generate-ground-ladders-helpers.js';

const LADDER_WIDTH = CONNECTIVITY.ladderWidth;
const LADDER_DEPTH = CONNECTIVITY.ladderDepth;

export function generateGroundLadders(ctx, culledWalkways) {
  const { data, config } = ctx;
  const groundLadders = [];
  const MAP_BOUNDARY_MARGIN = CONNECTIVITY.mapBoundaryMargin;

  for (let bi = 0; bi < data.buildings.length; bi++) {
    const b = data.buildings[bi];
    if (b.size === 'tower') continue;
    const bq = data.buildingQuadrants[bi];
    const present = bq.tiers[1] || new Set([0, 1, 2, 3]);

    for (const q of present) {
      const qr = getQuadrantRect(b, q);

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
        if (edge.side === 'north' && edge.z < MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'south' && edge.z > config.mapDepth - MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'west' && edge.x < MAP_BOUNDARY_MARGIN) continue;
        if (edge.side === 'east' && edge.x > config.mapWidth - MAP_BOUNDARY_MARGIN) continue;

        const ladderWidth = LADDER_WIDTH;
        const wallOffset = 0.3;
        let lx, lz, lw, ld;
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

        const ladder = buildGroundLadderForEdge(lx, lz, lw, ld, data, config);
        if (ladder) { ladder.platformDir = edge.side; groundLadders.push(ladder); }
      }
    }
  }

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
