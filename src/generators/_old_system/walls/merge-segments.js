/**
 * Merge adjacent segments with same height and baseY.
 */
export function mergeSegments(segments) {
  if (segments.length <= 1) return segments;
  const byRow = new Map();
  for (const s of segments) {
    const key = s.baseY.toFixed(2);
    if (!byRow.has(key)) byRow.set(key, []);
    byRow.get(key).push(s);
  }
  const merged = [];
  for (const [, rowSegs] of byRow) {
    rowSegs.sort((a, b) => (a.axis === 'x' ? a.x - b.x : a.z - b.z));
    let current = { ...rowSegs[0] };
    for (let i = 1; i < rowSegs.length; i++) {
      const next = rowSegs[i];
      const currEnd = current.axis === 'x' ? current.x + current.length : current.z + current.length;
      const nextStart = next.axis === 'x' ? next.x : next.z;
      if (Math.abs(currEnd - nextStart) < 0.01 && Math.abs(current.height - next.height) < 0.01) {
        current.length += next.length;
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
  }
  return merged;
}
