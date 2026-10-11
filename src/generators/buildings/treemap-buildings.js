import { createFoundationGrid } from './foundation-grid.js';
import { placeInFoundation } from './place-in-foundation.js';
import { cellCenterOut } from './spawn-patterns/cell-center-out.js';
import { cellTopLeft } from './spawn-patterns/cell-top-left.js';
import { BUILDINGS } from '../../config.js';
import { BUILDING_SIZES } from './building-sizes.js';

const CELL_PATTERNS = [cellCenterOut, cellTopLeft];

function placeRuinsFit(grid, baseKey, bi, rng, tiers, cellPattern) {
  const first = rng.chance(BUILDINGS.ruinsHorizontalChance) ? `${baseKey}-h` : `${baseKey}-v`;
  const second = first.endsWith('-h') ? `${baseKey}-v` : `${baseKey}-h`;
  return placeInFoundation(grid, first, bi, rng, tiers, cellPattern)
      ?? placeInFoundation(grid, second, bi, rng, tiers, cellPattern);
}

function pickEmptyBlocks(blockCount, rng) {
  const { min, max } = BUILDINGS.emptyBlocks;
  if (max <= 0) return new Set();
  const count = Math.min(rng.int(min, max), blockCount - 1);
  const order = rng.shuffle(Array.from({ length: blockCount }, (_, i) => i));
  return new Set(order.slice(0, count));
}

const footprintArea = (key) => BUILDING_SIZES[key].footprintW * BUILDING_SIZES[key].footprintD;

// Shuffle first so equal-area sizes (largeA / largeB) tie-break randomly; sort is stable.
function singleTryOrder(rng) {
  const shuffled = rng.shuffle([...BUILDINGS.singleSizes]);
  if (BUILDINGS.singleOrder !== 'largestFirst') return shuffled;
  return shuffled.sort((a, b) => footprintArea(b) - footprintArea(a));
}

function placeSingle(grid, bi, rng, tiers, cellPattern) {
  for (const sizeKey of singleTryOrder(rng)) {
    const b = placeInFoundation(grid, sizeKey, bi, rng, tiers, cellPattern);
    if (b) return b;
  }
  return null;
}

export function treemapBuildings(blocks, rng, tiers) {
  const buildings = [];
  const emptyBlocks = pickEmptyBlocks(blocks.length, rng);

  for (let bi = 0; bi < blocks.length; bi++) {
    if (emptyBlocks.has(bi)) continue;
    const block = blocks[bi];
    const grid = createFoundationGrid(block);
    const cellPattern = CELL_PATTERNS[rng.chance(BUILDINGS.centerOutPatternChance) ? 0 : 1];

    if (BUILDINGS.mode === 'single') {
      const only = placeSingle(grid, bi, rng, tiers, cellPattern);
      if (only) buildings.push(only);
      continue;
    }

    // Always consume the same RNG calls per block for determinism
    const tryLargeA = rng.chance(BUILDINGS.largeChance);
    const tryLargeB = rng.chance(BUILDINGS.largeChance);
    const mediumAttempts = Math.floor(grid.bbdW * grid.bbdD / BUILDINGS.mediumCellDivisor);
    const mediumChances = Array.from({ length: mediumAttempts }, () => rng.chance(BUILDINGS.mediumChance));

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

    let ruinsMedium = placeRuinsFit(grid, 'ruins-medium', bi, rng, tiers, cellPattern);
    while (ruinsMedium) {
      buildings.push(ruinsMedium);
      ruinsMedium = placeRuinsFit(grid, 'ruins-medium', bi, rng, tiers, cellPattern);
    }

    let ruinsSmall = placeInFoundation(grid, 'ruins-small', bi, rng, tiers, cellPattern);
    while (ruinsSmall) {
      buildings.push(ruinsSmall);
      ruinsSmall = placeInFoundation(grid, 'ruins-small', bi, rng, tiers, cellPattern);
    }
  }

  return buildings;
}
