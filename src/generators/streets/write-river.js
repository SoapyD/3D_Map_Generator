import { CELL, STAGE } from '../collision/matrix.js';
import { STREETS } from '../../config.js';

export function writeRiver(riverRects, matrix, config) {
  const depth = config.riverDepth ?? STREETS.riverDepth;

  for (let i = 0; i < riverRects.length; i++) {
    const { x, z, w, d } = riverRects[i];
    matrix.setWriteContext(STAGE.STREETS, i);
    // 1-unit-thick slab at Y = -depth (3 units below ground)
    matrix.fillBox(x, -depth, z, w, 1, d, CELL.RIVER);
    // Clear the STREET_PLACEHOLDER left by Stage 1 — river corridors are not streets,
    // and the placeholder at cy=-slabThickness would block anchor ray-casts at that level.
    matrix.fillBox(x, -config.slabThickness, z, w, config.slabThickness, d, CELL.EMPTY);
  }
}
