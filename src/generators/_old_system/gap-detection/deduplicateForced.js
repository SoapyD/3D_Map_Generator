/**
 * Remove forced walkways that overlap each other in XZ space.
 */
export function deduplicateForced(forced) {
  const deduped = [];
  for (const fw of forced) {
    let overlaps = false;
    for (const existing of deduped) {
      if (existing.axis !== fw.axis) continue;
      if (Math.abs(existing.y - fw.y) > 0.5) continue;
      if (fw.x < existing.x + existing.w + 1 && fw.x + fw.w > existing.x - 1 &&
          fw.z < existing.z + existing.d + 1 && fw.z + fw.d > existing.z - 1) {
        overlaps = true;
        break;
      }
    }
    if (!overlaps) deduped.push(fw);
  }
  return deduped;
}
