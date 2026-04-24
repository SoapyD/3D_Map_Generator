import { CELL } from '../collision/matrix.js';

const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };
const STEP = {
  N: { dx: 0, dz: -1 },
  S: { dx: 0, dz:  1 },
  E: { dx:  1, dz: 0 },
  W: { dx: -1, dz: 0 },
};

function anchorKey(anchor) {
  const c = anchor.cells[0];
  return `${c.cx},${c.cy},${c.cz}`;
}

function makeDebugRect(from, to, axis) {
  const y = from.y;
  if (axis === 'NS') {
    const zMin = Math.min(from.z, to.z);
    const zMax = Math.max(from.z, to.z) + from.d;
    return { x: from.x, y, z: zMin, w: from.w, h: 0.25, d: zMax - zMin };
  } else {
    const xMin = Math.min(from.x, to.x);
    const xMax = Math.max(from.x, to.x) + from.w;
    return { x: xMin, y, z: from.z, w: xMax - xMin, h: 0.25, d: from.d };
  }
}

/**
 * Phase 2 — ray-cast each anchor outward to find an opposite-facing partner.
 *
 * Ray walks cell-by-cell in the anchor's facing direction.
 * Terminates when:
 *   - an opposite-facing anchor is found at both cells of the current step → pair registered
 *   - a solid matrix cell (not CELL.EMPTY or CELL.SHELL) is encountered → ray blocked
 *   - maxConnectionLength is exceeded → anchor dies
 *
 * Both anchors fire rays so every pair is discovered twice; a seen-set deduplicates.
 * The returned connections include a precomputed debug rect for the visualiser.
 */
export function pairAnchors(anchors, matrix, config) {
  const maxLength = config.maxConnectionLength
    ?? Math.floor(Math.max(matrix.W, matrix.D) / 2);

  // Build cell → anchor lookup keyed by "cx,cy,cz"
  const cellMap = new Map();
  for (const anchor of anchors) {
    for (const cell of anchor.cells) {
      cellMap.set(`${cell.cx},${cell.cy},${cell.cz}`, anchor);
    }
  }

  const candidates = [];
  const seen = new Set();

  const TRACE_IDS = new Set(['A0148', 'A0150']);

  for (const anchorA of anchors) {
    const { dx, dz } = STEP[anchorA.direction];
    const opp = OPPOSITE[anchorA.direction];
    const [c0, c1] = anchorA.cells;
    const cy = c0.cy;
    const trace = TRACE_IDS.has(anchorA.id);

    if (trace) {
      console.log(`[pair] ${anchorA.id} dir=${anchorA.direction} cells=(${c0.cx},${cy},${c0.cz})+(${c1.cx},${cy},${c1.cz}) maxLen=${maxLength}`);
    }

    for (let dist = 1; dist <= maxLength; dist++) {
      const nx0 = c0.cx + dx * dist;
      const nz0 = c0.cz + dz * dist;
      const nx1 = c1.cx + dx * dist;
      const nz1 = c1.cz + dz * dist;

      // Check for an anchor at this step before the non-empty guard, because anchor
      // cells sit in otherwise-empty space and would pass the empty check anyway.
      // Accept a partial one-cell hit: anchors generated from buildings whose period-grid
      // columns don't align exactly can be offset by 1 cell in the perpendicular axis.
      // As long as one ray cell hits an opposite-facing anchor and the other is clear,
      // we treat it as a valid pair. Reject only when the two cells hit *different* anchors.
      const a0 = cellMap.get(`${nx0},${cy},${nz0}`);
      const a1 = cellMap.get(`${nx1},${cy},${nz1}`);

      const hitAnchor = (a0 && a0.direction === opp)
        ? ((a1 === a0 || !a1) ? a0 : null)   // exact or c0-only hit
        : (a1 && a1.direction === opp && !a0) ? a1  // c1-only hit
        : null;

      if (hitAnchor) {
        if (trace) console.log(`  dist=${dist} PAIRED with ${hitAnchor.id}${a0 !== a1 ? ' (partial-cell match)' : ''}`);
        const keyA = anchorKey(anchorA);
        const keyB = anchorKey(hitAnchor);
        const pairKey = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;

        if (!seen.has(pairKey)) {
          seen.add(pairKey);
          const axis = (dx !== 0) ? 'WE' : 'NS';
          const debugRect = makeDebugRect(anchorA, hitAnchor, axis);

          // Mutate both anchors to record their paired building ID
          anchorA.pairedBuildingId = hitAnchor.buildingId;
          hitAnchor.pairedBuildingId = anchorA.buildingId;

          candidates.push({
            from:            anchorA,
            to:              hitAnchor,
            fromBuildingId:  anchorA.buildingId,
            toBuildingId:    hitAnchor.buildingId,
            startXZ:         { x: anchorA.x, z: anchorA.z },
            endXZ:           { x: hitAnchor.x, z: hitAnchor.z },
            length:          dist,
            axis,
            blocked:         false,
            // Pre-computed world rect used only by the debug visualiser
            debugRect,
          });
        }
        break;
      }

      if (trace && (a0 || a1)) {
        console.log(`  dist=${dist} anchor cells hit different anchors or wrong dir: cell0=${a0?.id ?? 'none'}(${a0?.direction}) cell1=${a1?.id ?? 'none'}(${a1?.direction})`);
      }

      // Non-empty cell that isn't an anchor → path blocked
      const v0 = matrix.getCell(nx0, cy, nz0);
      const v1 = matrix.getCell(nx1, cy, nz1);
      if ((v0 !== CELL.EMPTY && v0 !== CELL.SHELL) || (v1 !== CELL.EMPTY && v1 !== CELL.SHELL)) {
        if (trace) console.log(`  dist=${dist} BLOCKED cell0=${v0} cell1=${v1} at (${nx0},${cy},${nz0})+(${nx1},${cy},${nz1})`);
        break;
      }

      if (trace && dist === maxLength) {
        console.log(`  dist=${dist} EXPIRED (maxLength)`);
      }
    }
  }

  return candidates;
}
