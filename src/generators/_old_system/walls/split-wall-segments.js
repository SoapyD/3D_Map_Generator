/**
 * Split a wall span into segments with gaps removed.
 * Returns array of {start, end} for surviving wall segments.
 */
export function splitWallSegments(wallStart, wallEnd, gaps) {
  const segments = [];
  let cursor = wallStart;
  for (const g of gaps) {
    if (g.start > cursor) segments.push({ start: cursor, end: g.start });
    cursor = g.end;
  }
  if (cursor < wallEnd) segments.push({ start: cursor, end: wallEnd });
  return segments.filter(s => (s.end - s.start) >= 0.1);
}
