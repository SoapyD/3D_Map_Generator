import { GLOBAL_GRID } from '../../config.js';

const BBD = GLOBAL_GRID.bbd;   // 4 inches
const SKIRT = 1;               // 1-inch skirt on each side

export const BUILDING_SIZES = {
  'ruins-small':  { footprintW: 2,  footprintD: 2,  bbdW: 1, bbdD: 1 },
  'ruins-medium-h': { footprintW: 10, footprintD: 2,  bbdW: 3, bbdD: 1 },
  'ruins-medium-v': { footprintW: 2,  footprintD: 10, bbdW: 1, bbdD: 3 },
  small:  { footprintW: 6,  footprintD: 6,  bbdW: 2, bbdD: 2 },
  medium: { footprintW: 10, footprintD: 10, bbdW: 3, bbdD: 3 },
  largeA: { footprintW: 18, footprintD: 10, bbdW: 5, bbdD: 3 },
  largeB: { footprintW: 10, footprintD: 18, bbdW: 3, bbdD: 5 },
};

export function bbdCellToWorldPos(foundationX, foundationZ, col, row, sizeKey) {
  const { footprintW, footprintD } = BUILDING_SIZES[sizeKey];
  return {
    x: foundationX + col * BBD + SKIRT,
    z: foundationZ + row * BBD + SKIRT,
    w: footprintW,
    d: footprintD,
  };
}
