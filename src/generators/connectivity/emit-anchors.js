import { CELL } from '../collision/matrix.js';

// Sets of labels that have a given face exposed (and therefore face that direction).
// END cells are named by their ONE *connected* face, so they expose the other three.
const FACING_N = new Set([
  CELL.FLOOR_N, CELL.FLOOR_NE, CELL.FLOOR_NW,
  CELL.FLOOR_END_S, CELL.FLOOR_END_E, CELL.FLOOR_END_W, CELL.FLOOR_ISLAND,
  CELL.IFLOOR_N, CELL.IFLOOR_NE, CELL.IFLOOR_NW,
  CELL.IFLOOR_END_S, CELL.IFLOOR_END_E, CELL.IFLOOR_END_W, CELL.IFLOOR_ISLAND,
  CELL.ROOF_N,
]);

const FACING_S = new Set([
  CELL.FLOOR_S, CELL.FLOOR_SE, CELL.FLOOR_SW,
  CELL.FLOOR_END_N, CELL.FLOOR_END_E, CELL.FLOOR_END_W, CELL.FLOOR_ISLAND,
  CELL.IFLOOR_S, CELL.IFLOOR_SE, CELL.IFLOOR_SW,
  CELL.IFLOOR_END_N, CELL.IFLOOR_END_E, CELL.IFLOOR_END_W, CELL.IFLOOR_ISLAND,
  CELL.ROOF_S,
]);

const FACING_E = new Set([
  CELL.FLOOR_E, CELL.FLOOR_NE, CELL.FLOOR_SE,
  CELL.FLOOR_END_N, CELL.FLOOR_END_S, CELL.FLOOR_END_W, CELL.FLOOR_ISLAND,
  CELL.IFLOOR_E, CELL.IFLOOR_NE, CELL.IFLOOR_SE,
  CELL.IFLOOR_END_N, CELL.IFLOOR_END_S, CELL.IFLOOR_END_W, CELL.IFLOOR_ISLAND,
  CELL.ROOF_E,
]);

const FACING_W = new Set([
  CELL.FLOOR_W, CELL.FLOOR_NW, CELL.FLOOR_SW,
  CELL.FLOOR_END_N, CELL.FLOOR_END_S, CELL.FLOOR_END_E, CELL.FLOOR_ISLAND,
  CELL.IFLOOR_W, CELL.IFLOOR_NW, CELL.IFLOOR_SW,
  CELL.IFLOOR_END_N, CELL.IFLOOR_END_S, CELL.IFLOOR_END_E, CELL.IFLOOR_ISLAND,
  CELL.ROOF_W,
]);

function isEmpty(v) {
  return v === CELL.EMPTY || v === CELL.SHELL;
}

let anchorCounter = 0;

function makeAnchor(direction, cx0, cy, cz0, cx1, cz1, matrix, buildingId) {
  const cs = matrix.cellSize;
  const wp = matrix.cellToWorld(cx0, cy, cz0);
  const isNS = direction === 'N' || direction === 'S';
  return {
    id:               `A${String(++anchorCounter).padStart(4, '0')}`,
    direction,
    buildingId:       buildingId ?? null,
    pairedBuildingId: null, // populated by Phase 2 when a connection is registered
    cells: [{ cx: cx0, cy, cz: cz0 }, { cx: cx1, cy, cz: cz1 }],
    tier: cy,
    x: wp.x,
    y: wp.y + matrix.cellSize - 0.25,
    z: wp.z,
    w: isNS ? 2 * cs : cs,
    d: isNS ? cs : 2 * cs,
  };
}

// Maps every cell position covered by a floor or roof rect to its buildingId.
function buildCellBuildingMap(data, matrix) {
  const map = new Map();
  const cs = matrix.cellSize;
  for (const level of [...data.floors, ...data.roofs]) {
    const cy = level.yCollisionLevel;
    for (const rect of level.rects) {
      const cx0 = Math.floor((rect.x - matrix.ox) / cs);
      const cz0 = Math.floor((rect.z - matrix.oz) / cs);
      const cxEnd = cx0 + Math.ceil(rect.w / cs);
      const czEnd = cz0 + Math.ceil(rect.d / cs);
      for (let cz = cz0; cz < czEnd; cz++)
        for (let cx = cx0; cx < cxEnd; cx++)
          map.set(`${cx},${cy},${cz}`, level.buildingId);
    }
  }
  return map;
}

/**
 * Phase 1 — emit anchors from floor/roof edge labels.
 *
 * N-S pass: outer Z, inner X with counter C along X.
 *   At C=0, checks (cx, cz) and (cx+1, cz) — 2 cells wide in X (walkway width).
 *   N-facing pair → anchor one step north (cz-1).
 *   S-facing pair → anchor one step south (cz+1).
 *
 * W-E pass: outer X, inner Z with counter C along Z.
 *   At C=0, checks (cx, cz) and (cx, cz+1) — 2 cells wide in Z.
 *   E-facing pair → anchor one step east (cx+1).
 *   W-facing pair → anchor one step west (cx-1).
 */
const ANY_FACING = new Set([
  ...FACING_N, ...FACING_S, ...FACING_E, ...FACING_W,
]);

function facesOf(v) {
  const f = [];
  if (FACING_N.has(v)) f.push('N');
  if (FACING_S.has(v)) f.push('S');
  if (FACING_E.has(v)) f.push('E');
  if (FACING_W.has(v)) f.push('W');
  return f.join('');
}

function makeTriggerCell(id, cx, cy, cz, faces, matrix) {
  const cs = matrix.cellSize;
  const wp = matrix.cellToWorld(cx, cy, cz);
  const offset = cs * 0.25;
  return {
    id,
    faces,
    cx, cy, cz,
    x: wp.x + offset,
    y: wp.y + cs - 0.25,
    z: wp.z + offset,
    w: cs * 0.5,
    d: cs * 0.5,
  };
}

export function emitAnchors(data, matrix, config) {
  anchorCounter = 0;
  const period = config.anchorPeriod ?? 4;
  const anchors = [];
  const cellBuilding = buildCellBuildingMap(data, matrix);
  const triggerCells = [];
  let triggerId = 0;

  // Deduplicate trigger cells — a cell can appear in both passes at the same position.
  const triggerSeen = new Set();

  const yLevels = new Set([
    ...data.floors.map(f => f.yCollisionLevel),
    ...data.roofs.map(r => r.yCollisionLevel),
  ]);

  function recordTrigger(cx, cy, cz) {
    const key = `${cx},${cy},${cz}`;
    if (triggerSeen.has(key)) return;
    triggerSeen.add(key);
    const v = matrix.getCell(cx, cy, cz);
    const faces = facesOf(v);
    if (!faces) return;
    triggerCells.push(makeTriggerCell(`T${String(++triggerId).padStart(4, '0')}`, cx, cy, cz, faces, matrix));
  }

  // Collect all floor/roof edge cells as trigger markers — only when visualizing.
  if (config.visualize) {
    for (const cy of yLevels) {
      for (let cz = 0; cz < matrix.D; cz++) {
        for (let cx = 0; cx < matrix.W; cx++) {
          if (ANY_FACING.has(matrix.getCell(cx, cy, cz))) recordTrigger(cx, cy, cz);
        }
      }
    }
  }

  for (const cy of yLevels) {
    // --- N-S pass ---
    for (let cz = 0; cz < matrix.D; cz++) {
      for (let cx = 0; cx < matrix.W - 1; cx++) {
        if (cx % period !== 0) continue;

        const v0 = matrix.getCell(cx,     cy, cz);
        const v1 = matrix.getCell(cx + 1, cy, cz);

        if (FACING_N.has(v0) && FACING_N.has(v1)) {
          if (isEmpty(matrix.getCell(cx, cy, cz - 1)) && isEmpty(matrix.getCell(cx + 1, cy, cz - 1))) {
            anchors.push(makeAnchor('N', cx, cy, cz - 1, cx + 1, cz - 1, matrix,
              cellBuilding.get(`${cx},${cy},${cz}`)));
          }
        }

        if (FACING_S.has(v0) && FACING_S.has(v1)) {
          if (isEmpty(matrix.getCell(cx, cy, cz + 1)) && isEmpty(matrix.getCell(cx + 1, cy, cz + 1))) {
            anchors.push(makeAnchor('S', cx, cy, cz + 1, cx + 1, cz + 1, matrix,
              cellBuilding.get(`${cx},${cy},${cz}`)));
          }
        }
      }
    }

    // --- W-E pass ---
    for (let cx = 0; cx < matrix.W; cx++) {
      for (let cz = 0; cz < matrix.D - 1; cz++) {
        if (cz % period !== 0) continue;

        const v0 = matrix.getCell(cx, cy, cz);
        const v1 = matrix.getCell(cx, cy, cz + 1);

        if (FACING_E.has(v0) && FACING_E.has(v1)) {
          if (isEmpty(matrix.getCell(cx + 1, cy, cz)) && isEmpty(matrix.getCell(cx + 1, cy, cz + 1))) {
            anchors.push(makeAnchor('E', cx + 1, cy, cz, cx + 1, cz + 1, matrix,
              cellBuilding.get(`${cx},${cy},${cz}`)));
          }
        }

        if (FACING_W.has(v0) && FACING_W.has(v1)) {
          if (isEmpty(matrix.getCell(cx - 1, cy, cz)) && isEmpty(matrix.getCell(cx - 1, cy, cz + 1))) {
            anchors.push(makeAnchor('W', cx - 1, cy, cz, cx - 1, cz + 1, matrix,
              cellBuilding.get(`${cx},${cy},${cz}`)));
          }
        }
      }
    }
  }

  return { anchors, triggerCells };
}
