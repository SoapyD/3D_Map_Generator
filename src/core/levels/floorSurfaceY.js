import { levelHeight } from './levelHeight.js';

/** World Y of tier i's walking surface (top of its slab). */
export function floorSurfaceY(i, config) {
  return i * levelHeight(config);
}
