import { getWallBounds } from './get-wall-bounds.js';

/**
 * Check if a rect overlaps a wall segment (with optional margin).
 */
export function rectCollidesWithWall(rect, wall, margin = 0) {
  const wb = getWallBounds(wall);
  return rect.x < wb.x1 + margin && rect.x + rect.w > wb.x - margin &&
         rect.z < wb.z1 + margin && rect.z + rect.d > wb.z - margin;
}
