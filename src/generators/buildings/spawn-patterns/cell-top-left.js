import { isCellRegionFree } from '../foundation-grid.js';

// Scans top-left to bottom-right — first free region wins.
export function cellTopLeft(grid, bbdW, bbdD) {
  for (let row = 0; row <= grid.bbdD - bbdD; row++)
    for (let col = 0; col <= grid.bbdW - bbdW; col++)
      if (isCellRegionFree(grid, col, row, bbdW, bbdD)) return { col, row };
  return null;
}
