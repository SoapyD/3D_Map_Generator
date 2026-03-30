/**
 * Shared utility functions for connectivity modules.
 */

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

/**
 * Check if two walkways intersect (AABB overlap at the same tier).
 */
export function walkwaysIntersect(a, b) {
  if (Math.abs(a.y - b.y) > 0.5) return false; // different tiers
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.z < b.z + b.d &&
    a.z + a.d > b.z
  );
}

/**
 * Get the rectangle for a specific quadrant of a building.
 */
export function getQuadrantRect(building, q) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;
  switch (q) {
    case 0: return { x: building.x, z: building.z, w: building.w / 2, d: building.d / 2 };
    case 1: return { x: mx, z: building.z, w: building.w / 2, d: building.d / 2 };
    case 2: return { x: building.x, z: mz, w: building.w / 2, d: building.d / 2 };
    case 3: return { x: mx, z: mz, w: building.w / 2, d: building.d / 2 };
  }
}

/**
 * Find which building a section belongs to.
 */
export function findBuildingIndex(section, buildings) {
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    if (section.x >= b.x - 0.1 && section.z >= b.z - 0.1 &&
        section.x + section.w <= b.x + b.w + 0.1 &&
        section.z + section.d <= b.z + b.d + 0.1) {
      return i;
    }
  }
  return -1;
}
