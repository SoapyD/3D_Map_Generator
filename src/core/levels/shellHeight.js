import { slabCellHeight } from './slabCellHeight.js';
import { floorCellY } from './floorCellY.js';

/** Height (matrix cells) of a building shell: ground slab cell up to and including the roof slab cell. */
export function shellHeight(maxTier, config) {
  return floorCellY(maxTier - 1, config) - floorCellY(0, config) + slabCellHeight(config);
}
