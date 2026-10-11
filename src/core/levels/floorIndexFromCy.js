import { slabCellHeight } from './slabCellHeight.js';
import { levelHeight } from './levelHeight.js';

/** Inverse of floorCellY: tier index owning a matrix Y (nearest slab cell). */
export function floorIndexFromCy(cy, config) {
  return Math.round((cy + slabCellHeight(config)) / levelHeight(config));
}
