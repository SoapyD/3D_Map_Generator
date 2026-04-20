import { CELL } from '../collision/matrix.js';
import { labelCells } from '../utils/label-cells.js';

function isRoofCell(v) {
  return v === CELL.ROOF || (v >= 41 && v <= 44);
}

export function labelRoofCells(data, matrix) {
  const yLevels = new Set(data.roofs.map(r => r.yCollisionLevel));

  labelCells(yLevels, matrix, isRoofCell, (cx, cy, cz, expN, expS, expE, expW) => {
    if (expN) return CELL.ROOF_N;
    if (expS) return CELL.ROOF_S;
    if (expE) return CELL.ROOF_E;
    if (expW) return CELL.ROOF_W;
    return null;
  });
}
