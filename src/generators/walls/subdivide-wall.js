/**
 * Splits a wall rect into a cols×rows cell grid (1" per cell, 1 row per inch of height).
 * Each cell carries { col, row, alive: true }.
 * colWidth and rowHeight store the actual dimensions for geometry reconstruction.
 */
export function subdivideWall(wall) {
  const isNS = wall.direction === 'N' || wall.direction === 'S';
  const wallLength = isNS ? wall.w : wall.d;

  const cols = Math.max(1, Math.round(wallLength));  // 1" columns (cellSize = 1)
  const rows = Math.max(1, Math.round(wall.h));       // 1" rows   (tierHeight = 3 → 3 rows)
  const colWidth  = wallLength / cols;
  const rowHeight = wall.h    / rows;

  const cells = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      cells.push({ col, row, alive: true });
    }
  }

  return { cells, cols, rows, colWidth, rowHeight };
}
