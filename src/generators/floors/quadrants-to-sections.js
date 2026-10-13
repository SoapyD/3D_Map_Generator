import { coverGridWithRects } from '../../core/grid-rect-cover/index.js';

// Quadrant indices on the 2x2 mask: 0 = top-left, 1 = top-right, 2 = bottom-left, 3 = bottom-right.
const QUAD_COLS = 2;
const QUAD_ROWS = 2;

/**
 * Covers the present quadrants of a building footprint with the fewest greedy rects (shared grid
 * cover). All four quadrants give one full-footprint rect.
 */
export function quadrantsToSections(building, present) {
  const halfW = building.w / QUAD_COLS;
  const halfD = building.d / QUAD_ROWS;

  return coverGridWithRects(QUAD_COLS, QUAD_ROWS, (c, r) => present.has(r * QUAD_COLS + c))
    .map((span) => ({
      x: building.x + span.col * halfW,
      z: building.z + span.row * halfD,
      w: span.cols * halfW,
      d: span.rows * halfD,
    }));
}
