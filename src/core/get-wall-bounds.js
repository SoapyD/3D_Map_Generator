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
