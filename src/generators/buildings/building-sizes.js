import { GLOBAL_GRID } from '../../config.js';

const BBD = GLOBAL_GRID.bbd;   // 4 inches
const SKIRT = 1;               // 1-inch skirt on each side

export const BUILDING_SIZES = {
  small:  { footprintW: 2, footprintD: 2, bbdW: 1, bbdD: 1 },
  medium: { footprintW: 6, footprintD: 6, bbdW: 2, bbdD: 2 },
  largeA: { footprintW: 6, footprintD: 10, bbdW: 2, bbdD: 3 },
  largeB: { footprintW: 10, footprintD: 6, bbdW: 3, bbdD: 2 },
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
