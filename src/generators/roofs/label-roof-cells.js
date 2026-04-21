import { CELL, STAGE } from '../collision/matrix.js';
import { labelCells } from '../utils/label-cells.js';

function isRoofCell(v) {
  return v === CELL.ROOF
    || (v >= 41 && v <= 48)    // ROOF_N … ROOF_SW
    || (v >= 91 && v <= 98)    // IROOF_N … IROOF_SW
    || (v >= 100 && v <= 104); // IROOF_END … IROOF_ISLAND
}

function allShell(...neighbours) {
  return neighbours.every(n => n === CELL.SHELL);
}

export function labelRoofCells(data, matrix) {
  const yLevels = new Set(data.roofs.map(r => r.yCollisionLevel));

  const buildingIndexForLevel = new Map();
  for (let i = 0; i < data.roofs.length; i++) {
    buildingIndexForLevel.set(data.roofs[i].yCollisionLevel, data.roofs[i].buildingIndex);
  }

  labelCells(yLevels, matrix, isRoofCell, (cx, cy, cz, expN, expS, expE, expW, nN, nS, nE, nW) => {
    matrix.setWriteContext(STAGE.ROOFS_LABEL, buildingIndexForLevel.get(cy) ?? 0);
    const expCount = (expN ? 1 : 0) + (expS ? 1 : 0) + (expE ? 1 : 0) + (expW ? 1 : 0);

    if (expCount === 0) return null;

    if (expCount === 4) {
      return allShell(nN, nS, nE, nW) ? CELL.IROOF_ISLAND : null;
    }

    if (expCount === 3) {
      if (!expN) return allShell(nS, nE, nW) ? CELL.IROOF_END_N : null;
      if (!expS) return allShell(nN, nE, nW) ? CELL.IROOF_END_S : null;
      if (!expE) return allShell(nN, nS, nW) ? CELL.IROOF_END_E : null;
      return allShell(nN, nS, nE) ? CELL.IROOF_END_W : null;
    }

    if (expCount === 2) {
      if (expN && expE) return allShell(nN, nE) ? CELL.IROOF_NE : CELL.ROOF_NE;
      if (expN && expW) return allShell(nN, nW) ? CELL.IROOF_NW : CELL.ROOF_NW;
      if (expS && expE) return allShell(nS, nE) ? CELL.IROOF_SE : CELL.ROOF_SE;
      if (expS && expW) return allShell(nS, nW) ? CELL.IROOF_SW : CELL.ROOF_SW;
    }

    if (expN) return nN === CELL.SHELL ? CELL.IROOF_N : CELL.ROOF_N;
    if (expS) return nS === CELL.SHELL ? CELL.IROOF_S : CELL.ROOF_S;
    if (expE) return nE === CELL.SHELL ? CELL.IROOF_E : CELL.ROOF_E;
    if (expW) return nW === CELL.SHELL ? CELL.IROOF_W : CELL.ROOF_W;

    return null;
  });
}
