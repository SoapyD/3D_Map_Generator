// Find the actual floor section edge for a building at this tier near a grid position
export function findFloorEdge(bi, axis, side, gridPos, state) {
  const { tierFloors, data, tier, buildings, cellSize } = state;
  const allSections = [...(tierFloors ? tierFloors.sections : [])];
  // Also check roofs at this tier
  if (data.roofs) {
    for (const r of data.roofs) {
      if (r.tier === tier && r.section) allSections.push(r.section);
    }
  }
  const bld = buildings[bi];
  if (!bld) return null;
  let bestEdge = null;
  for (const s of allSections) {
    if (s.x < bld.x - 0.5 || s.x + s.w > bld.x + bld.w + 0.5 ||
        s.z < bld.z - 0.5 || s.z + s.d > bld.z + bld.d + 0.5) continue;

    if (axis === 'x') {
      const rowZ = gridPos * cellSize;
      if (s.z <= rowZ + cellSize && s.z + s.d >= rowZ) {
        const edge = side === 'end' ? s.x + s.w : s.x;
        if (bestEdge === null || (side === 'end' ? edge > bestEdge : edge < bestEdge)) bestEdge = edge;
      }
    } else {
      const colX = gridPos * cellSize;
      if (s.x <= colX + cellSize && s.x + s.w >= colX) {
        const edge = side === 'end' ? s.z + s.d : s.z;
        if (bestEdge === null || (side === 'end' ? edge > bestEdge : edge < bestEdge)) bestEdge = edge;
      }
    }
  }
  return bestEdge;
}
