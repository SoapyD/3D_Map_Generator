import { floorThickness } from './floorThickness.js';
import { floorSurfaceY } from './floorSurfaceY.js';

/** World Y of the bottom face of tier i's rendered slab. */
export function floorGeomY(i, config) {
  return floorSurfaceY(i, config) - floorThickness(config);
}
