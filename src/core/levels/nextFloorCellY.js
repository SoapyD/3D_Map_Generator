import { levelHeight } from './levelHeight.js';

/** Matrix Y of the slab cell directly above the floor whose slab cell is at `cy` (the next tier's floor). */
export function nextFloorCellY(cy, config) {
  return cy + levelHeight(config);
}
