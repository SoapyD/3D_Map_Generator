import { CELL, STAGE } from '../collision/matrix.js';
import { WALL } from '../../config.js';

// Each direction collects its own label set (exterior + interior variants) plus
// both corner labels that include it. The outward neighbour check at emit time
// splits each cell into an exterior wall or an internal wall record.
const DIRECTIONS = [
  {
    labels: new Set([
      CELL.FLOOR_N,  CELL.FLOOR_NE,  CELL.FLOOR_NW,
      CELL.IFLOOR_N, CELL.IFLOOR_NE, CELL.IFLOOR_NW,
    ]),
    extWallCell: CELL.WALL_N, intWallCell: CELL.INTERNAL_WALL_N,
    dir: 'N', fixedAxis: 'cz', sortAxis: 'cx', dcx: 0, dcz: -1,
  },
  {
    labels: new Set([
      CELL.FLOOR_S,  CELL.FLOOR_SE,  CELL.FLOOR_SW,
      CELL.IFLOOR_S, CELL.IFLOOR_SE, CELL.IFLOOR_SW,
    ]),
    extWallCell: CELL.WALL_S, intWallCell: CELL.INTERNAL_WALL_S,
    dir: 'S', fixedAxis: 'cz', sortAxis: 'cx', dcx: 0, dcz: 1,
  },
  {
    labels: new Set([
      CELL.FLOOR_E,  CELL.FLOOR_NE,  CELL.FLOOR_SE,
      CELL.IFLOOR_E, CELL.IFLOOR_NE, CELL.IFLOOR_SE,
    ]),
    extWallCell: CELL.WALL_E, intWallCell: CELL.INTERNAL_WALL_E,
    dir: 'E', fixedAxis: 'cx', sortAxis: 'cz', dcx: 1, dcz: 0,
  },
  {
    labels: new Set([
      CELL.FLOOR_W,  CELL.FLOOR_NW,  CELL.FLOOR_SW,
      CELL.IFLOOR_W, CELL.IFLOOR_NW, CELL.IFLOOR_SW,
    ]),
    extWallCell: CELL.WALL_W, intWallCell: CELL.INTERNAL_WALL_W,
    dir: 'W', fixedAxis: 'cx', sortAxis: 'cz', dcx: -1, dcz: 0,
  },
];

// N/S walls yield to E/W walls at corners — trim only where an EXTERIOR E/W wall
// will actually be generated. Interior (IFLOOR) labels never produce real walls
// so they must not trigger truncation.
const W_EXPOSED = new Set([CELL.FLOOR_W, CELL.FLOOR_NW, CELL.FLOOR_SW]);
const E_EXPOSED = new Set([CELL.FLOOR_E, CELL.FLOOR_NE, CELL.FLOOR_SE]);

const END_ISLAND_CELLS = new Set([
  CELL.FLOOR_END_N,  CELL.FLOOR_END_S,  CELL.FLOOR_END_E,  CELL.FLOOR_END_W,  CELL.FLOOR_ISLAND,
  CELL.IFLOOR_END_N, CELL.IFLOOR_END_S, CELL.IFLOOR_END_E, CELL.IFLOOR_END_W, CELL.IFLOOR_ISLAND,
]);

const END_FACES = {
  [CELL.FLOOR_END_N]:  ['S', 'E', 'W'],
  [CELL.FLOOR_END_S]:  ['N', 'E', 'W'],
  [CELL.FLOOR_END_E]:  ['N', 'S', 'W'],
  [CELL.FLOOR_END_W]:  ['N', 'S', 'E'],
  [CELL.FLOOR_ISLAND]: ['N', 'S', 'E', 'W'],
  [CELL.IFLOOR_END_N]:  ['S', 'E', 'W'],
  [CELL.IFLOOR_END_S]:  ['N', 'E', 'W'],
  [CELL.IFLOOR_END_E]:  ['N', 'S', 'W'],
  [CELL.IFLOOR_END_W]:  ['N', 'S', 'E'],
  [CELL.IFLOOR_ISLAND]: ['N', 'S', 'E', 'W'],
};

function isSlabCell(v) {
  return v === CELL.FLOOR
    || (v >= 10 && v <= 34)   // FLOOR_N … FLOOR_ISLAND
    || (v >= 40 && v <= 44)   // ROOF … ROOF_W
    || (v >= 60 && v <= 74);  // IFLOOR variants
}

const FACE_OFFSET = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const FACE_EXT_WALL = { N: CELL.WALL_N, S: CELL.WALL_S, E: CELL.WALL_E, W: CELL.WALL_W };
const FACE_INT_WALL = {
  N: CELL.INTERNAL_WALL_N, S: CELL.INTERNAL_WALL_S,
  E: CELL.INTERNAL_WALL_E, W: CELL.INTERNAL_WALL_W,
};

function hasWExposure(v) {
  return W_EXPOSED.has(v)
    || v === CELL.FLOOR_END_N || v === CELL.FLOOR_END_S || v === CELL.FLOOR_ISLAND;
}

function hasEExposure(v) {
  return E_EXPOSED.has(v)
    || v === CELL.FLOOR_END_N || v === CELL.FLOOR_END_S || v === CELL.FLOOR_ISLAND;
}

// Group cells by fixedAxis and find contiguous runs along sortAxis.
function buildRuns(cells, fixedAxis, sortAxis) {
  const groups = new Map();
  for (const c of cells) {
    const key = c[fixedAxis];
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c[sortAxis]);
  }
  const runs = [];
  for (const [fixedVal, sortVals] of groups) {
    sortVals.sort((a, b) => a - b);
    let runStart = sortVals[0], runEnd = sortVals[0];
    for (let i = 1; i <= sortVals.length; i++) {
      if (i < sortVals.length && sortVals[i] === runEnd + 1) { runEnd = sortVals[i]; continue; }
      runs.push({ fixedVal, runStart, runEnd });
      if (i < sortVals.length) { runStart = runEnd = sortVals[i]; }
    }
  }
  return runs;
}

export function extractWallSegments(data, config, matrix) {
  const { wallThickness } = WALL;
  const { tierHeight, slabThickness } = config;
  const levelHeight = tierHeight + slabThickness;
  const { cellSize, ox, oz } = matrix;
  const s = cellSize;
  const t = wallThickness;

  const yLevels = [...new Set(data.floors.map(f => f.yCollisionLevel))];
  const walls = [];
  const internalWalls = [];

  // --- Main direction loop ---
  for (const cy of yLevels) {
    const wallWorldY = cy + slabThickness;

    for (const { labels, extWallCell, intWallCell, dir, fixedAxis, sortAxis, dcx, dcz } of DIRECTIONS) {
      const extCells = [];
      const intCells = [];

      for (let cz = 0; cz < matrix.D; cz++) {
        for (let cx = 0; cx < matrix.W; cx++) {
          if (!labels.has(matrix.getCell(cx, cy, cz))) continue;
          if (!isSlabCell(matrix.getCell(cx, cy + levelHeight, cz))) continue;
          if (matrix.getCell(cx, cy + 1, cz) === CELL.DOOR) continue;
          const neighbour = matrix.getCell(cx + dcx, cy, cz + dcz);
          if (neighbour === CELL.SHELL) {
            intCells.push({ cx, cz });
          } else {
            extCells.push({ cx, cz });
          }
        }
      }

      // Exterior runs — with corner truncation, write to matrix
      for (const { fixedVal, runStart, runEnd } of buildRuns(extCells, fixedAxis, sortAxis)) {
        const runLength = runEnd - runStart + 1;
        let x, z, w, d;

        if (dir === 'N') {
          const trimW = hasWExposure(matrix.getCell(runStart, cy, fixedVal))
            && matrix.getCell(runStart - 1, cy, fixedVal) !== CELL.SHELL;
          const trimE = hasEExposure(matrix.getCell(runEnd,   cy, fixedVal))
            && matrix.getCell(runEnd   + 1, cy, fixedVal) !== CELL.SHELL;
          x = ox + runStart * s + (trimW ? t : 0);
          w = runLength * s - (trimW ? t : 0) - (trimE ? t : 0);
          z = oz + fixedVal * s;
          d = t;
        } else if (dir === 'S') {
          const trimW = hasWExposure(matrix.getCell(runStart, cy, fixedVal))
            && matrix.getCell(runStart - 1, cy, fixedVal) !== CELL.SHELL;
          const trimE = hasEExposure(matrix.getCell(runEnd,   cy, fixedVal))
            && matrix.getCell(runEnd   + 1, cy, fixedVal) !== CELL.SHELL;
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
      }

      // Interior runs — no truncation, no geometry, write internal wall marker to matrix
      for (const { fixedVal, runStart, runEnd } of buildRuns(intCells, fixedAxis, sortAxis)) {
        const runLength = runEnd - runStart + 1;
        let x, z, w, d;

        if (dir === 'N') {
          x = ox + runStart * s; w = runLength * s; z = oz + fixedVal * s;       d = t;
        } else if (dir === 'S') {
          x = ox + runStart * s; w = runLength * s; z = oz + (fixedVal + 1) * s - t; d = t;
        } else if (dir === 'E') {
          x = ox + (fixedVal + 1) * s - t; z = oz + runStart * s; w = t; d = runLength * s;
        } else {
          x = ox + fixedVal * s;            z = oz + runStart * s; w = t; d = runLength * s;
        }

        matrix.setWriteContext(STAGE.WALLS_INT, internalWalls.length);
        internalWalls.push({ direction: dir, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
        matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, intWallCell);
      }
    }
  }

  // --- END and ISLAND cells: individual per-face wall boxes ---
  for (const cy of yLevels) {
    const wallWorldY = cy + slabThickness;

    for (let cz = 0; cz < matrix.D; cz++) {
      for (let cx = 0; cx < matrix.W; cx++) {
        const v = matrix.getCell(cx, cy, cz);
        const faces = END_FACES[v];
        if (!faces) continue;
        if (!isSlabCell(matrix.getCell(cx, cy + levelHeight, cz))) continue;
        if (matrix.getCell(cx, cy + 1, cz) === CELL.DOOR) continue;

        const hasE = faces.includes('E') && matrix.getCell(cx + 1, cy, cz) !== CELL.SHELL;
        const hasW = faces.includes('W') && matrix.getCell(cx - 1, cy, cz) !== CELL.SHELL;

        for (const face of faces) {
          const [fdcx, fdcz] = FACE_OFFSET[face];
          const neighbour = matrix.getCell(cx + fdcx, cy, cz + fdcz);
          const isInternal = neighbour === CELL.SHELL;

          let x, z, w, d;

          if (face === 'N' || face === 'S') {
            x = ox + cx * s + (hasW ? t : 0);
            w = s - (hasW ? t : 0) - (hasE ? t : 0);
            z = face === 'N' ? oz + cz * s : oz + (cz + 1) * s - t;
            d = t;
          } else {
            x = face === 'E' ? ox + (cx + 1) * s - t : ox + cx * s;
            z = oz + cz * s;
            w = t;
            d = s;
          }

          if (isInternal) {
            matrix.setWriteContext(STAGE.WALLS_INT, internalWalls.length);
            internalWalls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
            matrix.fillBox(x, wallWorldY, z, w, tierHeight, d, FACE_INT_WALL[face]);
          } else {
            walls.push({ direction: face, floorY: cy, x, y: wallWorldY, z, w, h: tierHeight, d });
          }
        }
      }
    }
  }

  return { walls, internalWalls };
}
