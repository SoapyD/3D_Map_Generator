import { BUILDING_SIZES, bbdCellToWorldPos } from './building-sizes.js';
import { markCells } from './foundation-grid.js';

export function placeInFoundation(grid, sizeKey, blockIndex, rng, tiers, cellPattern) {
  const { bbdW, bbdD } = BUILDING_SIZES[sizeKey];
  const cell = cellPattern(grid, bbdW, bbdD);
  if (!cell) return null;
  markCells(grid, cell.col, cell.row, bbdW, bbdD);
  const pos = bbdCellToWorldPos(grid.block.x, grid.block.z, cell.col, cell.row, sizeKey);
  const maxTier = rng.int(1, tiers);
  return { ...pos, maxTier, size: sizeKey, blockIndex };
}
