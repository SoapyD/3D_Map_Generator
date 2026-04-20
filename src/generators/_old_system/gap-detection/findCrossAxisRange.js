// Find the cross-axis range of floor/roof sections at a building's endpoint edge
// Returns { min, max } or null if no floor found at that edge
export function findCrossAxisRange(bi, edgeAxis, edgeSide, edgePos, state) {
  const { tierFloors, data, tier, buildings } = state;
  const bld = buildings[bi];
  if (!bld) return null;
  const allSections = [...(tierFloors ? tierFloors.sections : [])];
  if (data.roofs) {
    for (const r of data.roofs) {
      if (r.tier === tier && r.section) allSections.push(r.section);
    }
  }
  let rangeMin = Infinity, rangeMax = -Infinity;
  for (const s of allSections) {
    if (s.x < bld.x - 0.5 || s.x + s.w > bld.x + bld.w + 0.5 ||
        s.z < bld.z - 0.5 || s.z + s.d > bld.z + bld.d + 0.5) continue;
    if (edgeAxis === 'x') {
      const sEdge = edgeSide === 'end' ? s.x + s.w : s.x;
      if (Math.abs(sEdge - edgePos) > 0.5) continue;
      if (s.z < rangeMin) rangeMin = s.z;
      if (s.z + s.d > rangeMax) rangeMax = s.z + s.d;
    } else {
      const sEdge = edgeSide === 'end' ? s.z + s.d : s.z;
      if (Math.abs(sEdge - edgePos) > 0.5) continue;
      if (s.x < rangeMin) rangeMin = s.x;
      if (s.x + s.w > rangeMax) rangeMax = s.x + s.w;
    }
  }
  return rangeMin < rangeMax ? { min: rangeMin, max: rangeMax } : null;
}
