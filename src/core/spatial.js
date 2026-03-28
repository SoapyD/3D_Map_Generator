/**
 * Spatial utility functions — shared helpers for overlap and collision checks.
 */

/**
 * Check if two axis-aligned rects overlap in the XZ plane.
 * Both rects must have { x, z, w, d } properties.
 */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.z < b.z + b.d && a.z + a.d > b.z;
}

/**
 * Get the XZ bounding box of a wall segment.
 * Returns { x, z, x1, z1, w, d }.
 */
export function getWallBounds(wall) {
  const w = wall.axis === 'x' ? wall.length : wall.thickness;
  const d = wall.axis === 'z' ? wall.length : wall.thickness;
  return {
    x: wall.x,
    z: wall.z,
    x1: wall.x + w,
    z1: wall.z + d,
    w,
    d,
  };
}

/**
 * Check if a rect overlaps a wall segment (with optional margin).
 */
export function rectCollidesWithWall(rect, wall, margin = 0) {
  const wb = getWallBounds(wall);
  return rect.x < wb.x1 + margin && rect.x + rect.w > wb.x - margin &&
         rect.z < wb.z1 + margin && rect.z + rect.d > wb.z - margin;
}

/**
 * Get a quadrant rectangle from building bounds.
 * Quadrants: 0=NW, 1=NE, 2=SW, 3=SE.
 */
export function getQuadrantRect(building, quadrant) {
  const mx = building.x + building.w / 2;
  const mz = building.z + building.d / 2;
  const hw = building.w / 2;
  const hd = building.d / 2;
  switch (quadrant) {
    case 0: return { x: building.x, z: building.z, w: hw, d: hd };
    case 1: return { x: mx, z: building.z, w: hw, d: hd };
    case 2: return { x: building.x, z: mz, w: hw, d: hd };
    case 3: return { x: mx, z: mz, w: hw, d: hd };
  }
}
