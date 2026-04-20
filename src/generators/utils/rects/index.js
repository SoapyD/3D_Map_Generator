export function placementValid(candidates, blocks, streetBounds) {
  const bounds = getBounds(candidates);
  const blockCount = blocks.filter(b => rectsOverlap(bounds, b)).length;
  if (blockCount !== 1) return false;
  if (streetBounds.some(s => rectsOverlap(bounds, s))) return false;
  return true;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w - 0.01 && a.x + a.w > b.x + 0.01
      && a.z < b.z + b.d - 0.01 && a.z + a.d > b.z + 0.01;
}

export function getBounds(segments) {
  const x  = Math.min(...segments.map(s => s.x));
  const z  = Math.min(...segments.map(s => s.z));
  const x2 = Math.max(...segments.map(s => s.x + s.w));
  const z2 = Math.max(...segments.map(s => s.z + s.d));
  return { x, z, w: x2 - x, d: z2 - z };
}

export function overlapsAny(segments, checkAgainst) {
  for (const seg of segments) {
    for (const other of checkAgainst) {
      if (seg.textureGroup !== undefined && seg.textureGroup === other.textureGroup) continue;
      if (seg._groupMarker && seg._groupMarker === other._groupMarker) continue;
      if (rectsOverlap(seg, other)) return true;
    }
  }
  return false;
}
