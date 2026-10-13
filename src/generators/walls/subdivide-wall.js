import { GLOBAL_GRID } from '../../config.js';

const EPS = 1e-6;

/**
 * Splits a wall rect into a cols×rows cell grid (1" per column, 1" per row; a fractional
 * remainder becomes a shorter top row, e.g. a 2.75" wall gives rows of [1, 1, 0.75]).
 * Each cell carries { col, row, alive: true }.
 * colWidth, rowHeights and rowOffsets store the actual dimensions for geometry reconstruction.
 */
export function subdivideWall(wall) {
  const isNS = wall.direction === 'N' || wall.direction === 'S';
  const wallLength = isNS ? wall.w : wall.d;

  const cols = Math.max(1, Math.round(wallLength));  // 1" columns (cellSize = 1)
  const rows = Math.max(1, Math.ceil(wall.h / GLOBAL_GRID.cellSize - EPS)); // 1" rows, last may be short
  const colWidth = wallLength / cols;
  const rowHeights = [];
  const rowOffsets = [];
  for (let row = 0; row < rows; row++) {
    const offset = row * GLOBAL_GRID.cellSize;
    rowOffsets.push(offset);
    rowHeights.push(Math.min(GLOBAL_GRID.cellSize, wall.h - offset));
  }

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row, alive: true });
    }
  }

  return { cells, cols, rows, colWidth, rowHeights, rowOffsets };
}
