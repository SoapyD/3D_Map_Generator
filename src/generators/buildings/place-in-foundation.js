import { BUILDING_SIZES, bbdCellToWorldPos } from './building-sizes.js';
import { markCells } from './foundation-grid.js';

function ruinsTier(rng, tiers) {
  const roll = rng.random();
  const tier = roll < 0.50 ? 2 : roll < 0.90 ? 3 : 4;
  return Math.min(tier, tiers); // never taller than the map's tier count
}

export function placeInFoundation(grid, sizeKey, blockIndex, rng, tiers, cellPattern) {
  const { bbdW, bbdD } = BUILDING_SIZES[sizeKey];
  const cell = cellPattern(grid, bbdW, bbdD);
  if (!cell) return null;
  markCells(grid, cell.col, cell.row, bbdW, bbdD);
  const pos = bbdCellToWorldPos(grid.block.x, grid.block.z, cell.col, cell.row, sizeKey);
  const maxTier = sizeKey === 'ruins-small' ? ruinsTier(rng, tiers) : rng.int(2, tiers);
  const floorOrientation = sizeKey === 'ruins-small' ? (rng.chance(0.5) ? 'H' : 'V') : null;
  return { ...pos, maxTier, size: sizeKey, blockIndex, floorOrientation };
}
