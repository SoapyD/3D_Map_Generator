// Orders foundations so the one nearest the map centre is processed first,
// radiating outward. Affects visualizer display order and RNG sequence.
export function foundationCenterOut(blocks, activeArea) {
  const cx = activeArea.x + activeArea.w / 2;
  const cz = activeArea.z + activeArea.d / 2;
  return [...blocks].sort((a, b) => {
    const da = Math.hypot((a.x + a.w / 2) - cx, (a.z + a.d / 2) - cz);
    const db = Math.hypot((b.x + b.w / 2) - cx, (b.z + b.d / 2) - cz);
    return da - db;
  });
}
