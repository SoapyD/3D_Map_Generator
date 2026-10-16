/**
 * Union of two XZ rectangles when - and only when - it is exactly a rectangle: they share a full
 * edge (equal extent on one axis, touching end-to-end on the other). Returns { x, z, w, d } or null.
 * Overlapping or gapped rectangles never merge.
 */
export function mergeTwoBoxes(a, b, epsilon) {
  const eq = (p, q) => Math.abs(p - q) < epsilon;

  if (eq(a.x, b.x) && eq(a.w, b.w)) {
    if (eq(a.z + a.d, b.z)) return { x: a.x, z: a.z, w: a.w, d: a.d + b.d };
    if (eq(b.z + b.d, a.z)) return { x: a.x, z: b.z, w: a.w, d: a.d + b.d };
  }
  if (eq(a.z, b.z) && eq(a.d, b.d)) {
    if (eq(a.x + a.w, b.x)) return { x: a.x, z: a.z, w: a.w + b.w, d: a.d };
    if (eq(b.x + b.w, a.x)) return { x: b.x, z: a.z, w: a.w + b.w, d: a.d };
  }
  return null;
}
