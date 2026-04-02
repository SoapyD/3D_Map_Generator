/**
 * Check if two axis-aligned rects overlap in the XZ plane.
 * Both rects must have { x, z, w, d } properties.
 */
export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.z < b.z + b.d && a.z + a.d > b.z;
}
