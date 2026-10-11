import { slabCellHeight } from './slabCellHeight.js';

/** World Y at which walls start for the floor whose slab cell is at matrix Y `cy` (= that floor's surface). */
export function wallBaseY(cy, config) {
  return cy + slabCellHeight(config);
}
