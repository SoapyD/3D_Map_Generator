import { createFoundationGrid } from './foundation-grid.js';
import { placeInFoundation } from './place-in-foundation.js';
import { cellCenterOut } from './spawn-patterns/cell-center-out.js';
import { cellTopLeft } from './spawn-patterns/cell-top-left.js';

const CELL_PATTERNS = [cellCenterOut, cellTopLeft];

export function treemapBuildings(blocks, rng, tiers) {
  const buildings = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const grid = createFoundationGrid(block);
    const cellPattern = CELL_PATTERNS[rng.chance(0.5) ? 0 : 1];

    // Always consume the same RNG calls per block for determinism
    const tryLargeA = rng.chance(0.4);
    const tryLargeB = rng.chance(0.4);
    const mediumAttempts = Math.floor(grid.bbdW * grid.bbdD / 4);
    const mediumChances = Array.from({ length: mediumAttempts }, () => rng.chance(0.5));

    if (tryLargeA) {
      const b = placeInFoundation(grid, 'largeA', bi, rng, tiers, cellPattern);
      if (b) buildings.push(b);
    }
    if (tryLargeB) {
      const b = placeInFoundation(grid, 'largeB', bi, rng, tiers, cellPattern);
      if (b) buildings.push(b);
    }

    for (let i = 0; i < mediumAttempts; i++) {
      if (mediumChances[i]) {
        const b = placeInFoundation(grid, 'medium', bi, rng, tiers, cellPattern);
        if (b) buildings.push(b);
      }
    }

    let placed = placeInFoundation(grid, 'small', bi, rng, tiers, cellPattern);
    while (placed) {
      buildings.push(placed);
      placed = placeInFoundation(grid, 'small', bi, rng, tiers, cellPattern);
    }
  }

  return buildings;
}
