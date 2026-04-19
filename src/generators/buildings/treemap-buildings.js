import { createFoundationGrid } from './foundation-grid.js';
import { placeInFoundation } from './place-in-foundation.js';

export function treemapBuildings(blocks, rng, tiers) {
  const buildings = [];

  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    const grid = createFoundationGrid(block);

    // Always consume the same RNG calls per block for determinism
    const tryLargeA = rng.chance(0.4);
    const tryLargeB = rng.chance(0.4);
    const mediumAttempts = Math.floor(grid.bbdW * grid.bbdD / 4);
    const mediumChances = Array.from({ length: mediumAttempts }, () => rng.chance(0.5));

    if (tryLargeA) {
      const b = placeInFoundation(grid, 'largeA', bi, rng, tiers);
      if (b) buildings.push(b);
    }
    if (tryLargeB) {
      const b = placeInFoundation(grid, 'largeB', bi, rng, tiers);
      if (b) buildings.push(b);
    }

    for (let i = 0; i < mediumAttempts; i++) {
      if (mediumChances[i]) {
        const b = placeInFoundation(grid, 'medium', bi, rng, tiers);
        if (b) buildings.push(b);
      }
    }

    // Fill remaining cells with small buildings
    let placed = placeInFoundation(grid, 'small', bi, rng, tiers);
    while (placed) {
      buildings.push(placed);
      placed = placeInFoundation(grid, 'small', bi, rng, tiers);
    }
  }

  return buildings;
}
