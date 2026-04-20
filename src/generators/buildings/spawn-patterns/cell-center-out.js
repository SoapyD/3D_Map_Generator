import { isCellRegionFree } from '../foundation-grid.js';

// Picks the free region whose centre is closest to the foundation centre.
export function cellCenterOut(grid, bbdW, bbdD) {
  const cx = grid.bbdW / 2;
  const cz = grid.bbdD / 2;
  let best = null, bestDist = Infinity;
  for (let row = 0; row <= grid.bbdD - bbdD; row++) {
    for (let col = 0; col <= grid.bbdW - bbdW; col++) {
      if (!isCellRegionFree(grid, col, row, bbdW, bbdD)) continue;
      const dist = Math.hypot((col + bbdW / 2) - cx, (row + bbdD / 2) - cz);
      if (dist < bestDist) { bestDist = dist; best = { col, row }; }
    }
  }
  return best;
}
