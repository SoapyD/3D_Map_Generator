/**
 * Check if two objects are within a given distance (edge-to-edge).
 */
export function isClose(a, b, dist) {
  const ax1 = a.x, ax2 = a.x + (a.w || 0);
  const az1 = a.z, az2 = a.z + (a.d || 0);
  const bx1 = b.x, bx2 = b.x + (b.w || 0);
  const bz1 = b.z, bz2 = b.z + (b.d || 0);

  // Gap between edges (0 or negative if overlapping)
  const gapX = Math.max(0, Math.max(ax1 - bx2, bx1 - ax2));
  const gapZ = Math.max(0, Math.max(az1 - bz2, bz1 - az2));

  return gapX <= dist && gapZ <= dist;
}
