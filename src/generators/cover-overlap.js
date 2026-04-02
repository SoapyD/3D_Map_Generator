import { rectsOverlap } from '../core/rects-overlap.js';

/**
 * Check if a piece overlaps any item in a list (XZ overlap, Y within 1").
 */
export function overlapsAny(piece, list) {
  for (const existing of list) {
    if (existing.y !== undefined && Math.abs(existing.y - piece.y) > 1) continue;
    if (rectsOverlap(piece, existing)) return true;
  }
  return false;
}
