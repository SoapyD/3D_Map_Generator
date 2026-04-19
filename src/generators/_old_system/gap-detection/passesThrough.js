// Check if a proposed walkway passes through a floor or roof at the same tier
// wAxis: 'x' or 'z' — the axis the walkway runs along
export function passesThrough(wx, wz, ww, wd, wTier, wAxis, state) {
  const { floors, data, config, cellSize } = state;
  // Check floor sections at this tier — block if walkway passes through along its travel axis
  const fl = floors[wTier];
  if (fl) {
    for (const s of fl.sections) {
      const overlapX = Math.min(wx + ww, s.x + s.w) - Math.max(wx, s.x);
      const overlapZ = Math.min(wz + wd, s.z + s.d) - Math.max(wz, s.z);
      // Only block if there's significant overlap along the walkway's travel direction
      if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
      if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
    }
  }
  // Check roofs at this tier
  if (data.roofs) {
    for (const r of data.roofs) {
      if (r.tier !== wTier) continue;
      const s = r.section || r.building;
      if (!s) continue;
      const sw = s.w || 0, sd = s.d || 0;
      const overlapX = Math.min(wx + ww, s.x + sw) - Math.max(wx, s.x);
      const overlapZ = Math.min(wz + wd, s.z + sd) - Math.max(wz, s.z);
      if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
      if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
    }
  }
  // Check floors at other tiers — only block SAME orientation overlaps
  // A N/S walkway shouldn't be blocked by a floor that an E/W walkway would pass through
  for (let t = 1; t <= config.tiers; t++) {
    if (t === wTier) continue;
    if (wTier > t) continue; // only block if walkway is at or below this tier
    const otherFl = floors[t];
    if (!otherFl) continue;
    for (const s of otherFl.sections) {
      const overlapX = Math.min(wx + ww, s.x + s.w) - Math.max(wx, s.x);
      const overlapZ = Math.min(wz + wd, s.z + s.d) - Math.max(wz, s.z);
      if (wAxis === 'x' && overlapX > cellSize && overlapZ > 0) return true;
      if (wAxis === 'z' && overlapZ > cellSize && overlapX > 0) return true;
    }
  }
  return false;
}
