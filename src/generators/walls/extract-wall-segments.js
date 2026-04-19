import { CELL } from '../collision/matrix.js';
import { WALL } from '../../config.js';

// Each direction collects its own label plus both corner labels that include it
const DIRECTIONS = [
  { floorLabels: [CELL.FLOOR_N, CELL.FLOOR_NE, CELL.FLOOR_NW], wallCell: CELL.WALL_N, dir: 'N', fixedAxis: 'cz', sortAxis: 'cx' },
  { floorLabels: [CELL.FLOOR_S, CELL.FLOOR_SE, CELL.FLOOR_SW], wallCell: CELL.WALL_S, dir: 'S', fixedAxis: 'cz', sortAxis: 'cx' },
  { floorLabels: [CELL.FLOOR_E, CELL.FLOOR_NE, CELL.FLOOR_SE], wallCell: CELL.WALL_E, dir: 'E', fixedAxis: 'cx', sortAxis: 'cz' },
  { floorLabels: [CELL.FLOOR_W, CELL.FLOOR_NW, CELL.FLOOR_SW], wallCell: CELL.WALL_W, dir: 'W', fixedAxis: 'cx', sortAxis: 'cz' },
];

// N/S walls yield to E/W walls at corners — trim where the perpendicular cell has W or E exposure
const W_EXPOSED = new Set([CELL.FLOOR_W, CELL.FLOOR_NW, CELL.FLOOR_SW]);
const E_EXPOSED = new Set([CELL.FLOOR_E, CELL.FLOOR_NE, CELL.FLOOR_SE]);

function isFloorCell(v) {
  return v === CELL.FLOOR || (v >= 10 && v <= 17) || (v >= 30 && v <= 34);
}

function hasWExposure(v) {
  return W_EXPOSED.has(v) || v === CELL.FLOOR_END_N || v === CELL.FLOOR_END_S || v === CELL.FLOOR_ISLAND;
}

function hasEExposure(v) {
  return E_EXPOSED.has(v) || v === CELL.FLOOR_END_N || v === CELL.FLOOR_END_S || v === CELL.FLOOR_ISLAND;
}

/**
 * Pass 2 — Segment grouping, wall rect computation, and END/ISLAND generation.
 *
 * Main loop: scans directional floor labels, groups contiguous runs, emits wall rects.
 * N/S walls are truncated at ends where E/W walls will meet them (clean corner joints).
 *
 * Secondary loop: END (3-exposed) and ISLAND (4-exposed) cells generate individual
 * wall boxes per exposed face. N/S walls on these cells are trimmed where E/W co-exist.
 */
export function extractWallSegments(data, config, matrix) {
  const { wallThickness } = WALL;
  const { tierHeight, slabThickness } = config;
  const { cellSize, ox, oz } = matrix;
  const s = cellSize;
  const t = wallThickness;

  const yLevels = [...new Set(data.floors.map(f => f.yCollisionLevel))];
  const walls = [];

  // --- Main direction loop (single + corner floor labels) ---
  for (const cy of yLevels) {
    const wallWorldY = cy + slabThickness;

    for (const { floorLabels, wallCell, dir, fixedAxis, sortAxis } of DIRECTIONS) {
      const labelSet = new Set(floorLabels);
      const cells = [];
      for (let cz = 0; cz < matrix.D; cz++) {
        for (let cx = 0; cx < matrix.W; cx++) {
          if (labelSet.has(matrix.getCell(cx, cy, cz))) {
            cells.push({ cx, cz });
          }
        }
      }

      const groups = new Map();
      for (const c of cells) {
        const key = c[fixedAxis];
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c[sortAxis]);
      }

      for (const [fixedVal, sortVals] of groups) {
        sortVals.sort((a, b) => a - b);

        let runStart = sortVals[0];
        let runEnd   = sortVals[0];

        for (let i = 1; i <= sortVals.length; i++) {
          if (i < sortVals.length && sortVals[i] === runEnd + 1) {
            runEnd = sortVals[i];
            continue;
          }

          const runLength = runEnd - runStart + 1;
          let x, z, w, d;

          if (dir === 'N') {
            const trimW = hasWExposure(matrix.getCell(runStart, cy, fixedVal));
            const trimE = hasEExposure(matrix.getCell(runEnd,   cy, fixedVal));
            x = ox + runStart * s + (trimW ? t : 0);
            w = runLength * s - (trimW ? t : 0) - (trimE ? t : 0);
            z = oz + fixedVal * s;
            d = t;
          } else if (dir === 'S') {
            const trimW = hasWExposure(matrix.getCell(runStart, cy, fixedVal));
            const trimE = hasEExposure(matrix.getCell(runEnd,   cy, fixedVal));
            x = ox + runStart * s + (trimW ? t : 0);
            w = runLength * s - (trimW ? t : 0) - (trimE ? t : 0);
            z = oz + (fixedVal + 1) * s - t;
            d = t;
          } else if (dir === 'E') {
            x = ox + (fixedVal + 1) * s - t;
            z = oz + runStart * s;
            w = t;
            d = runLength * s;
          } else {
            x = ox + fixedVal * s;
            z = oz + runStart * s;
            w = t;
            d = runLength * s;
          }

          walls.push({ direction: dir, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
          matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, wallCell);

          if (i < sortVals.length) { runStart = sortVals[i]; runEnd = sortVals[i]; }
        }
      }
    }
  }

  // --- END and ISLAND cells: individual per-face wall boxes ---
  const END_FACES = {
    [CELL.FLOOR_END_N]: ['S', 'E', 'W'],  // N connected → S+E+W exposed
    [CELL.FLOOR_END_S]: ['N', 'E', 'W'],
    [CELL.FLOOR_END_E]: ['N', 'S', 'W'],
    [CELL.FLOOR_END_W]: ['N', 'S', 'E'],
    [CELL.FLOOR_ISLAND]: ['N', 'S', 'E', 'W'],
  };

  for (const cy of yLevels) {
    const wallWorldY = cy + slabThickness;

    for (let cz = 0; cz < matrix.D; cz++) {
      for (let cx = 0; cx < matrix.W; cx++) {
        const v = matrix.getCell(cx, cy, cz);
        const faces = END_FACES[v];
        if (!faces) continue;

        const hasE = faces.includes('E');
        const hasW = faces.includes('W');

        for (const face of faces) {
          let x, z, w, d, wallCell;

          if (face === 'N' || face === 'S') {
            // N/S yield to E/W: trim both ends where perpendicular walls exist
            x = ox + cx * s + (hasW ? t : 0);
            w = s - (hasW ? t : 0) - (hasE ? t : 0);
            z = face === 'N' ? oz + cz * s : oz + (cz + 1) * s - t;
            d = t;
            wallCell = face === 'N' ? CELL.WALL_N : CELL.WALL_S;
          } else {
            // E/W run full cell depth
            x = face === 'E' ? ox + (cx + 1) * s - t : ox + cx * s;
            z = oz + cz * s;
            w = t;
            d = s;
            wallCell = face === 'E' ? CELL.WALL_E : CELL.WALL_W;
          }

          walls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
          matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, wallCell);
        }
      }
    }
  }

  return walls;
}
