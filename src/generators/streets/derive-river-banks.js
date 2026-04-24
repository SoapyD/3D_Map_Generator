/**
 * Phase 3b — derive bank edges by scanning river cells in the collision matrix.
 *
 * For every CELL.RIVER cell, checks its 4 horizontal neighbours. Any neighbour
 * that is not CELL.RIVER needs a bank. Contiguous same-direction edge cells are
 * merged into single bank records. CELL.RIVER_BANK is written at river-bed level
 * on the non-river side of each edge so banks appear in the matrix grid overlay.
 *
 * Bank record:
 *   { x, z, length, axis: 'NS'|'WE', facing: 'N'|'S'|'E'|'W', bottomY, topY }
 */
import { CELL, STAGE } from '../collision/matrix.js';

export function deriveRiverBanks(riverRects, matrix, riverDepth) {
  const bankCy = -riverDepth;
  const { ox, oz, cellSize: cs } = matrix;

  // Collect edge positions keyed by their bank-face grid coordinate.
  // N/S banks run along X — keyed by cz of the face.
  // E/W banks run along Z — keyed by cx of the face.
  const nEdges = new Map(); // faceCz → Set<cx>
  const sEdges = new Map(); // faceCz → Set<cx>
  const eEdges = new Map(); // faceCx → Set<cz>
  const wEdges = new Map(); // faceCx → Set<cz>

  for (const rect of riverRects) {
    const cxStart = Math.round((rect.x - ox) / cs);
    const czStart = Math.round((rect.z - oz) / cs);
    const nCx     = Math.round(rect.w / cs);
    const nCz     = Math.round(rect.d / cs);

    for (let dcx = 0; dcx < nCx; dcx++) {
      for (let dcz = 0; dcz < nCz; dcz++) {
        const cx = cxStart + dcx;
        const cz = czStart + dcz;
        if (matrix.getCell(cx, bankCy, cz) !== CELL.RIVER) continue;

        if (matrix.getCell(cx, bankCy, cz - 1) !== CELL.RIVER) addTo(nEdges, cz,     cx);
        if (matrix.getCell(cx, bankCy, cz + 1) !== CELL.RIVER) addTo(sEdges, cz + 1, cx);
        if (matrix.getCell(cx + 1, bankCy, cz) !== CELL.RIVER) addTo(eEdges, cx + 1, cz);
        if (matrix.getCell(cx - 1, bankCy, cz) !== CELL.RIVER) addTo(wEdges, cx,     cz);
      }
    }
  }

  const banks = [];
  matrix.setWriteContext(STAGE.STREETS, 0);

  // N/S banks — axis='WE', run along X
  for (const [faceCz, cxSet] of nEdges) {
    for (const run of mergeRuns([...cxSet])) {
      for (let i = 0; i < run.count; i++)
        matrix.setCell(run.start + i, bankCy, faceCz - 1, CELL.RIVER_BANK);
      banks.push({ x: ox + run.start * cs, z: oz + faceCz * cs, length: run.count * cs, axis: 'WE', facing: 'N', bottomY: -riverDepth, topY: 0 });
    }
  }
  for (const [faceCz, cxSet] of sEdges) {
    for (const run of mergeRuns([...cxSet])) {
      for (let i = 0; i < run.count; i++)
        matrix.setCell(run.start + i, bankCy, faceCz, CELL.RIVER_BANK);
      banks.push({ x: ox + run.start * cs, z: oz + faceCz * cs, length: run.count * cs, axis: 'WE', facing: 'S', bottomY: -riverDepth, topY: 0 });
    }
  }

  // E/W banks — axis='NS', run along Z
  for (const [faceCx, czSet] of eEdges) {
    for (const run of mergeRuns([...czSet])) {
      for (let i = 0; i < run.count; i++)
        matrix.setCell(faceCx, bankCy, run.start + i, CELL.RIVER_BANK);
      banks.push({ x: ox + faceCx * cs, z: oz + run.start * cs, length: run.count * cs, axis: 'NS', facing: 'E', bottomY: -riverDepth, topY: 0 });
    }
  }
  for (const [faceCx, czSet] of wEdges) {
    for (const run of mergeRuns([...czSet])) {
      for (let i = 0; i < run.count; i++)
        matrix.setCell(faceCx - 1, bankCy, run.start + i, CELL.RIVER_BANK);
      banks.push({ x: ox + faceCx * cs, z: oz + run.start * cs, length: run.count * cs, axis: 'NS', facing: 'W', bottomY: -riverDepth, topY: 0 });
    }
  }

  return banks;
}

function addTo(map, key, value) {
  if (!map.has(key)) map.set(key, new Set());
  map.get(key).add(value);
}

function mergeRuns(indices) {
  if (!indices.length) return [];
  indices.sort((a, b) => a - b);
  const runs = [];
  let start = indices[0], end = indices[0];
  for (let i = 1; i < indices.length; i++) {
    if (indices[i] === end + 1) { end = indices[i]; }
    else { runs.push({ start, count: end - start + 1 }); start = end = indices[i]; }
  }
  runs.push({ start, count: end - start + 1 });
  return runs;
}
