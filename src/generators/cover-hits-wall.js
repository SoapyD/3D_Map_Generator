import { rectCollidesWithWall } from '../core/rect-collides-with-wall.js';

/**
 * Check if a piece overlaps any wall (ground-level only if groundOnly is true).
 */
export function hitsAnyWall(piece, walls, groundOnly = false) {
  for (const wall of walls) {
    if (groundOnly && wall.baseY > 1) continue;
    if (rectCollidesWithWall(piece, wall)) return true;
  }
  return false;
}
