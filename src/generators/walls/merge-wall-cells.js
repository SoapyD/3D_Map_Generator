/**
 * Converts a damaged wall cell grid back into a list of wall rects.
 *
 * Alive cells in the same row are merged into contiguous runs.
 * N/S walls run along the X axis; E/W walls run along the Z axis.
 */
export function mergeWallCells(grid, wall) {
  const isNS = wall.direction === 'N' || wall.direction === 'S';
  const rects = [];

  for (let row = 0; row < grid.rows; row++) {
    const rowCells = grid.cells
      .filter(c => c.alive && c.row === row)
      .sort((a, b) => a.col - b.col);

    if (rowCells.length === 0) continue;

    let runStart = rowCells[0].col;
    let runEnd   = rowCells[0].col;

    for (let i = 1; i <= rowCells.length; i++) {
      if (i < rowCells.length && rowCells[i].col === runEnd + 1) {
        runEnd = rowCells[i].col;
        continue;
      }

      const runCols = runEnd - runStart + 1;
      const segY = wall.y + row * grid.rowHeight;

      if (isNS) {
        rects.push({
          direction: wall.direction, floorY: wall.floorY,
          x: wall.x + runStart * grid.colWidth, y: segY, z: wall.z,
          w: runCols * grid.colWidth, h: grid.rowHeight, d: wall.d,
        });
      } else {
        rects.push({
          direction: wall.direction, floorY: wall.floorY,
          x: wall.x, y: segY, z: wall.z + runStart * grid.colWidth,
          w: wall.w, h: grid.rowHeight, d: runCols * grid.colWidth,
        });
      }

      if (i < rowCells.length) runStart = runEnd = rowCells[i].col;
    }
  }

  return rects;
}
