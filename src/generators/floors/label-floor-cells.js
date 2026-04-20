import { CELL } from '../collision/matrix.js';
import { labelCells } from '../utils/label-cells.js';

function isFloorCell(v) {
  return v === CELL.FLOOR
    || (v >= 10 && v <= 17)   // exterior directional + corner labels
    || (v >= 30 && v <= 34)   // exterior end + island labels
    || (v >= 60 && v <= 74);  // interior (IFLOOR) labels — must be included so
                               // relabelled cells are still recognised as floor by later iterations
}

// All exposed neighbours pointing into the shell volume → purely interior-facing cell.
// Any EMPTY/OOB neighbour means at least one face is exterior → use exterior label.
function allInternal(...neighbours) {
  return neighbours.every(n => n === CELL.SHELL);
}

export function labelFloorCells(data, matrix) {
  const yLevels = new Set(data.floors.map(f => f.yCollisionLevel));

  labelCells(yLevels, matrix, isFloorCell, (cx, cy, cz, expN, expS, expE, expW, nN, nS, nE, nW) => {
    const expCount = (expN ? 1 : 0) + (expS ? 1 : 0) + (expE ? 1 : 0) + (expW ? 1 : 0);

    if (expCount === 4) {
      return allInternal(nN, nS, nE, nW) ? CELL.IFLOOR_ISLAND : CELL.FLOOR_ISLAND;
    }

    if (expCount === 3) {
      if (!expN) return allInternal(nS, nE, nW) ? CELL.IFLOOR_END_N : CELL.FLOOR_END_N;
      if (!expS) return allInternal(nN, nE, nW) ? CELL.IFLOOR_END_S : CELL.FLOOR_END_S;
      if (!expE) return allInternal(nN, nS, nW) ? CELL.IFLOOR_END_E : CELL.FLOOR_END_E;
      return allInternal(nN, nS, nE) ? CELL.IFLOOR_END_W : CELL.FLOOR_END_W;
    }

    if (expN && expE) return allInternal(nN, nE) ? CELL.IFLOOR_NE : CELL.FLOOR_NE;
    if (expN && expW) return allInternal(nN, nW) ? CELL.IFLOOR_NW : CELL.FLOOR_NW;
    if (expS && expE) return allInternal(nS, nE) ? CELL.IFLOOR_SE : CELL.FLOOR_SE;
    if (expS && expW) return allInternal(nS, nW) ? CELL.IFLOOR_SW : CELL.FLOOR_SW;
    if (expN) return nN === CELL.SHELL ? CELL.IFLOOR_N : CELL.FLOOR_N;
    if (expS) return nS === CELL.SHELL ? CELL.IFLOOR_S : CELL.FLOOR_S;
    if (expE) return nE === CELL.SHELL ? CELL.IFLOOR_E : CELL.FLOOR_E;
    if (expW) return nW === CELL.SHELL ? CELL.IFLOOR_W : CELL.FLOOR_W;
    return null;
  });
}
