// Processes foundations nearest to the map centre first, radiating outward.
export function centerOut(blocks, activeArea) {
  const cx = activeArea.x + activeArea.w / 2;
  const cz = activeArea.z + activeArea.d / 2;

  return [...blocks].sort((a, b) => {
    const distA = Math.hypot((a.x + a.w / 2) - cx, (a.z + a.d / 2) - cz);
    const distB = Math.hypot((b.x + b.w / 2) - cx, (b.z + b.d / 2) - cz);
    return distA - distB;
  });
}
