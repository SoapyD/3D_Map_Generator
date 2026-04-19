import { CELL } from '../collision/matrix.js';
import { labelCells } from '../utils/label-cells.js';

function isFloorCell(v) {
  return v === CELL.FLOOR || (v >= 10 && v <= 17) || (v >= 30 && v <= 34);
}

export function labelFloorCells(data, matrix) {
  const yLevels = new Set(data.floors.map(f => f.yCollisionLevel));

  labelCells(yLevels, matrix, isFloorCell, (cx, cy, cz, expN, expS, expE, expW) => {
    const expCount = (expN ? 1 : 0) + (expS ? 1 : 0) + (expE ? 1 : 0) + (expW ? 1 : 0);

    if (expCount === 4) return CELL.FLOOR_ISLAND;

    if (expCount === 3) {
      if (!expN) return CELL.FLOOR_END_N;
      if (!expS) return CELL.FLOOR_END_S;
      if (!expE) return CELL.FLOOR_END_E;
      return CELL.FLOOR_END_W;
    }

    if (expN && expE) return CELL.FLOOR_NE;
    if (expN && expW) return CELL.FLOOR_NW;
    if (expS && expE) return CELL.FLOOR_SE;
    if (expS && expW) return CELL.FLOOR_SW;
    if (expN) return CELL.FLOOR_N;
    if (expS) return CELL.FLOOR_S;
    if (expE) return CELL.FLOOR_E;
    if (expW) return CELL.FLOOR_W;
    return null;
  });
}
