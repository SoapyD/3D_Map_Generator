import { coverGridWithRects } from '../../core/grid-rect-cover/index.js';

/**
 * Converts a damaged wall cell grid back into a list of wall rects.
 *
 * Alive cells are covered by a greedy rectangle cover (runs along the wall, stacked across rows
 * when the whole run is alive in the next row). N/S walls run along the X axis; E/W walls run
 * along the Z axis. Greedy, not minimal: windows and damage holes can leave more rects than the
 * optimum.
 */
export function mergeWallCells(grid, wall) {
  const isNS = wall.direction === 'N' || wall.direction === 'S';

  const aliveAt = new Uint8Array(grid.cols * grid.rows);
  for (const c of grid.cells) {
    if (c.alive) aliveAt[c.row * grid.cols + c.col] = 1;
  }

  return coverGridWithRects(grid.cols, grid.rows, (c, r) => aliveAt[r * grid.cols + c] === 1)
    .map((span) => {
      const segY = wall.y + grid.rowOffsets[span.row];
      let segH = 0;
      for (let r = span.row; r < span.row + span.rows; r++) segH += grid.rowHeights[r];

      if (isNS) {
        return {
          direction: wall.direction, floorY: wall.floorY,
          x: wall.x + span.col * grid.colWidth, y: segY, z: wall.z,
          w: span.cols * grid.colWidth, h: segH, d: wall.d,
        };
      }
      return {
        direction: wall.direction, floorY: wall.floorY,
        x: wall.x, y: segY, z: wall.z + span.col * grid.colWidth,
        w: wall.w, h: segH, d: span.cols * grid.colWidth,
      };
    });
}
