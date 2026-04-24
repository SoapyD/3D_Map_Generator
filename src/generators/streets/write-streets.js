import { CELL, STAGE } from '../collision/matrix.js';

export function writeStreets(streetRects, matrix, config) {
  const { slabThickness } = config;
  for (let i = 0; i < streetRects.length; i++) {
    const { x, z, w, d } = streetRects[i];
    matrix.setWriteContext(STAGE.STREETS, i);
    matrix.fillBox(x, -slabThickness, z, w, slabThickness, d, CELL.STREET);
  }
}
