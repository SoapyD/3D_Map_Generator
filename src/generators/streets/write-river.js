import { CELL, STAGE } from '../collision/matrix.js';
import { STREETS } from '../../config.js';

export function writeRiver(riverRects, matrix, config) {
  const depth = config.riverDepth ?? STREETS.riverDepth;

  for (let i = 0; i < riverRects.length; i++) {
    const { x, z, w, d } = riverRects[i];
    matrix.setWriteContext(STAGE.STREETS, i);
    // 1-unit-thick slab at Y = -depth (3 units below ground)
    matrix.fillBox(x, -depth, z, w, 1, d, CELL.RIVER);
  }
}
