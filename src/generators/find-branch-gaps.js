/**
 * Find gap intervals along a bridge wall where branches connect.
 * Returns merged gap intervals along the wall's run axis.
 */
export function findBranchGaps(bridge, wallAxis, wallStart, wallEnd, fixedPos, allBranches) {
  const gaps = [];
  for (const br of allBranches) {
    // Must be at similar Y and perpendicular
    if (Math.abs(br.y - bridge.y) > 0.5) continue;
    if (br.axis === bridge.axis) continue;

    let brMin, brMax;
    if (wallAxis === 'x') {
      // Wall runs along X; branch crosses in Z
      const brZ1 = br.z, brZ2 = br.z + br.d;
      if (fixedPos < brZ1 - 0.5 || fixedPos > brZ2 + 0.5) continue;
      brMin = br.x;
      brMax = br.x + br.w;
    } else {
      // Wall runs along Z; branch crosses in X
      const brX1 = br.x, brX2 = br.x + br.w;
      if (fixedPos < brX1 - 0.5 || fixedPos > brX2 + 0.5) continue;
      brMin = br.z;
      brMax = br.z + br.d;
    }

    const margin = 0.25;
    const gapStart = Math.max(wallStart, brMin - margin);
    const gapEnd = Math.min(wallEnd, brMax + margin);
    if (gapEnd > gapStart) gaps.push({ start: gapStart, end: gapEnd });
  }

  // Sort and merge overlapping
  gaps.sort((a, b) => a.start - b.start);
  const merged = [];
  for (const g of gaps) {
    if (merged.length > 0 && g.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, g.end);
    } else {
      merged.push({ ...g });
    }
  }
  return merged;
}
