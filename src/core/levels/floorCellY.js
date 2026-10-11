import { slabCellHeight } from './slabCellHeight.js';
import { levelHeight } from './levelHeight.js';

/** Matrix Y of tier i's slab cell. */
export function floorCellY(i, config) {
  return i * levelHeight(config) - slabCellHeight(config);
}
