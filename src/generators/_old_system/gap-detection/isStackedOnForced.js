// Check if a proposed walkway stacks on another FORCED connection (same axis, different tier, XZ overlap)
// Allows stacking on regular walkways — forced connections fill critical gaps
export function isStackedOnForced(w, forced) {
  for (const ew of forced) {
    if (ew.axis !== w.axis) continue;
    if (Math.abs(ew.y - w.y) < 0.5) continue;
    if (w.x < ew.x + ew.w && w.x + w.w > ew.x && w.z < ew.z + ew.d && w.z + w.d > ew.z) {
      return true;
    }
  }
  return false;
}
