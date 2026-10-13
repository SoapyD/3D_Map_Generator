/**
 * Greedy rectangle cover of a boolean grid. Pure and deterministic (no RNG).
 *
 * Scans row-major. From each unassigned alive cell it extends right while cells are alive and
 * unassigned, then extends down while the whole next row segment is alive and unassigned. The
 * result is a partition of the alive cells into non-overlapping rects. It is greedy, not minimal:
 * grids with holes (windows, blob damage) can need more rects than the optimum.
 *
 * Index space only: callers map the spans to inches, so each caller keeps its own exact arithmetic
 * (for example a short top wall row).
 *
 * @param {number} cols  grid width in cells
 * @param {number} rows  grid height in cells
 * @param {(col: number, row: number) => boolean} alive  true when the cell is part of the shape
 * @returns {{ col: number, row: number, cols: number, rows: number }[]} spans in scan order
 */
export function coverGridWithRects(cols, rows, alive) {
  const used = new Uint8Array(cols * rows);
  const free = (c, r) => used[r * cols + c] === 0 && alive(c, r);
  const spans = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!free(c, r)) continue;

      let width = 1;
      while (c + width < cols && free(c + width, r)) width++;

      let height = 1;
      while (r + height < rows && rowFree(free, c, width, r + height)) height++;

      for (let dr = 0; dr < height; dr++) {
        for (let dc = 0; dc < width; dc++) used[(r + dr) * cols + c + dc] = 1;
      }
      spans.push({ col: c, row: r, cols: width, rows: height });
    }
  }

  return spans;
}

function rowFree(free, c, width, r) {
  for (let dc = 0; dc < width; dc++) {
    if (!free(c + dc, r)) return false;
  }
  return true;
}
