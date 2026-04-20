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
